import { chmod, copyFile, lstat, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { extractComponent } from "./archive";
import { componentPresent } from "./component-integrity";
import { downloadResource, matchesResource } from "./download";
import { verifyLocalComponent } from "./local-component-verification";
import { componentDirectory, componentHash } from "./resource-paths";
import type { VoiceComponent } from "./resource-types";

export const installComponent = async (
  root: string,
  component: VoiceComponent,
  signal: AbortSignal,
  progress: (received: number, total: number) => void,
): Promise<void> => {
  signal.throwIfAborted();
  if (await componentPresent(root, component, true)) return;
  const staging = join(root, "staging", componentHash(component));
  if (component.archive) {
    await mkdir(join(root, "staging"), { recursive: true, mode: 0o700 });
    const archive = staging + ".tar.gz";
    await downloadResource(
      { path: "bundle.tar.gz", ...component.archive },
      archive,
      signal,
      (received) => progress(received, component.archive!.bytes),
    );
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true, mode: 0o700 });
    try {
      await extractComponent(archive, staging, component, signal);
      signal.throwIfAborted();
      await placeComponent(root, component, staging);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    await rm(archive, { force: true });
    return;
  }
  await mkdir(staging, { recursive: true, mode: 0o700 });
  let completed = 0;
  const total = component.files.reduce((sum, file) => sum + file.bytes, 0);
  for (const file of component.files) {
    signal.throwIfAborted();
    const destination = join(staging, file.path);
    await mkdir(join(destination, ".."), { recursive: true, mode: 0o700 });
    if (!(await matchesResource(destination, file))) {
      await downloadResource(file, destination, signal, (received) =>
        progress(completed + received, total),
      );
    }
    if (file.executable && process.platform !== "win32") await chmod(destination, 0o700);
    completed += file.bytes;
    progress(completed, total);
  }
  signal.throwIfAborted();
  await placeComponent(root, component, staging);
};

export const placeComponent = async (
  root: string,
  component: VoiceComponent,
  staging: string,
): Promise<void> => {
  const target = componentDirectory(root, component);
  await mkdir(join(target, ".."), { recursive: true, mode: 0o700 });
  const backup = target + ".repair-" + crypto.randomUUID();
  let replaced = false;
  try {
    await rename(target, backup);
    replaced = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await rename(staging, target);
    if (replaced) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (replaced) await rename(backup, target);
    throw error;
  }
};

export const importEngineFiles = async (
  root: string,
  component: VoiceComponent,
  source: string,
): Promise<void> => {
  const staging = join(root, "staging", crypto.randomUUID());
  await mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    await verifyLocalComponent(source, component);
    for (const file of component.files) {
      const original = join(source, file.path);
      if (!(await matchesResource(original, file)))
        throw new Error("voice_engine_integrity_failed");
      const destination = join(staging, file.path);
      await mkdir(join(destination, ".."), { recursive: true, mode: 0o700 });
      await copyFile(original, destination);
      if (file.executable && process.platform !== "win32") await chmod(destination, 0o700);
    }
    await placeComponent(root, component, staging);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};

export const removeManagedTree = async (directory: string): Promise<void> => {
  try {
    if ((await lstat(directory)).isSymbolicLink()) throw new Error("voice_resource_path_invalid");
    await rm(directory, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};
