import { createHash } from "node:crypto";
import { open, readFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Message } from "@earendil-works/pi-ai";

import type { SessionData, SessionHeader } from "../types/storage";
import { atomicWrite } from "../../utils/atomic-write";

type Metadata = {
  format: "loop-session";
  version: 3;
  header: SessionHeader;
  generation: string;
  start: number;
  bytes: number;
  messageCount: number;
};

type Entry = { messageIndex: number; byteOffset: number };
type Index = { generation: string; entries: Entry[] };

export type HistoryPage = {
  messages: Message[];
  start: number;
  end: number;
  total: number;
  revision: string;
};

const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const encode = (messages: readonly Message[]) =>
  messages.map((row) => JSON.stringify(row) + "\n").join("");

const indexMessages = (messages: readonly Message[], generation: string): Index => {
  let byteOffset = 0;
  const entries: Entry[] = [];
  for (const [messageIndex, message] of messages.entries()) {
    if (message.role === "user") entries.push({ messageIndex, byteOffset });
    byteOffset += Buffer.byteLength(JSON.stringify(message) + "\n");
  }
  return { generation, entries };
};

const metadata = async (path: string): Promise<Metadata> => {
  const value = JSON.parse(await readFile(path, "utf8")) as Metadata;
  if (value.format !== "loop-session" || value.version !== 3)
    throw new Error("Unsupported session format or version");
  if (
    !value.header ||
    !/^[a-f0-9]{64}$/.test(value.generation) ||
    ![value.start, value.bytes, value.messageCount].every((n) => Number.isSafeInteger(n) && n >= 0)
  )
    throw new Error("Invalid session metadata");
  return value;
};

const readRange = async (path: string, start: number, length: number) => {
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
      const { bytesRead } = await file.read(buffer, offset, length - offset, start + offset);
      if (!bytesRead) throw new Error("Incomplete session messages");
      offset += bytesRead;
    }
    return buffer.toString("utf8");
  } finally {
    await file.close();
  }
};

export const readSessionFiles = async (path: string): Promise<SessionData> => {
  const meta = await metadata(path);
  const text = await readRange(join(dirname(path), "messages.jsonl"), meta.start, meta.bytes);
  if (digest(text) !== meta.generation) throw new Error("Session message checksum mismatch");
  const messages = text.trim()
    ? text
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  if (messages.length !== meta.messageCount) throw new Error("Invalid session message count");
  return { header: meta.header, messages };
};

export const writeSessionFiles = async (
  path: string,
  data: SessionData,
  metadataOnly = false,
): Promise<void> => {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let previous: Metadata | undefined;
  try {
    previous = await metadata(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (metadataOnly && previous) {
    await atomicWrite(path, JSON.stringify({ ...previous, header: data.header }) + "\n");
    return;
  }
  const text = encode(data.messages);
  const generation = digest(text);
  let start = previous?.start ?? 0;
  if (previous?.generation !== generation) {
    const file = await open(join(directory, "messages.jsonl"), "a+", 0o600);
    try {
      const committedEnd = previous ? previous.start + previous.bytes : 0;
      await file.truncate(committedEnd);
      let suffix = text;
      if (previous) {
        const old = await readRange(
          join(directory, "messages.jsonl"),
          previous.start,
          previous.bytes,
        );
        if (text.startsWith(old)) suffix = text.slice(old.length);
        else start = committedEnd;
      }
      await file.writeFile(suffix);
      await file.sync();
    } finally {
      await file.close();
    }
  }
  const next: Metadata = {
    format: "loop-session",
    version: 3,
    header: data.header,
    generation,
    start,
    bytes: Buffer.byteLength(text),
    messageCount: data.messages.length,
  };
  // Metadata is the commit point. An interrupted append is ignored and truncated on retry.
  await atomicWrite(path, JSON.stringify(next) + "\n");
  // The index is a rebuildable cache; its failure must not undo a committed history.
  await atomicWrite(
    join(directory, "index.json"),
    JSON.stringify(indexMessages(data.messages, generation)) + "\n",
  ).catch(() => {});
};

export const migrateSessionFiles = async (legacy: string, data: SessionData): Promise<string> => {
  const directory = legacy.slice(0, -6);
  const path = join(directory, "meta.json");
  try {
    await stat(path);
    return path;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const staging = directory + ".migrate-" + crypto.randomUUID();
  try {
    await writeSessionFiles(join(staging, "meta.json"), data);
    await rename(staging, directory);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return path;
};

export const readHistoryPage = async (
  path: string,
  before?: number,
  revision?: string,
): Promise<HistoryPage> => {
  const meta = await metadata(path);
  if (revision && revision !== meta.generation) throw new Error("Session history changed");
  const end = before ?? meta.messageCount;
  if (!Number.isSafeInteger(end) || end < 0 || end > meta.messageCount)
    throw new Error("Invalid history cursor");
  if (end === 0)
    return { messages: [], start: 0, end: 0, total: meta.messageCount, revision: meta.generation };
  let index: Index;
  try {
    index = JSON.parse(await readFile(join(dirname(path), "index.json"), "utf8"));
    if (
      index.generation !== meta.generation ||
      !Array.isArray(index.entries) ||
      index.entries.some(
        (row, i) =>
          !Number.isSafeInteger(row.messageIndex) ||
          !Number.isSafeInteger(row.byteOffset) ||
          row.messageIndex < 0 ||
          row.messageIndex >= meta.messageCount ||
          row.byteOffset < 0 ||
          row.byteOffset >= meta.bytes ||
          (i > 0 &&
            (row.messageIndex <= index.entries[i - 1]!.messageIndex ||
              row.byteOffset <= index.entries[i - 1]!.byteOffset)),
      )
    )
      throw new Error("Invalid index");
  } catch {
    const data = await readSessionFiles(path);
    index = indexMessages(data.messages, meta.generation);
    await atomicWrite(join(dirname(path), "index.json"), JSON.stringify(index) + "\n").catch(
      () => {},
    );
  }
  const rounds = index.entries.filter((row) => row.messageIndex < end);
  const first = rounds.at(-3);
  const start = rounds.length <= 3 ? 0 : first!.messageIndex;
  const offset = start === 0 ? 0 : first!.byteOffset;
  const endOffset =
    end === meta.messageCount
      ? meta.bytes
      : index.entries.find((row) => row.messageIndex === end)?.byteOffset;
  if (endOffset === undefined) throw new Error("Invalid history cursor");
  const text = await readRange(
    join(dirname(path), "messages.jsonl"),
    meta.start + offset,
    endOffset - offset,
  );
  const messages = text
    ? text
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  return { messages, start, end, total: meta.messageCount, revision: meta.generation };
};
