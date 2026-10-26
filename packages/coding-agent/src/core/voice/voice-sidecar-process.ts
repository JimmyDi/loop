import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

import { encodeVoiceCommand } from "./command-encoder";
import type { VoiceCommand, VoiceFrame } from "./protocol-types";
import { VoiceFrameDecoder } from "./voice-frame-decoder";
import type { VoicePendingRequest } from "./voice-sidecar-types";
import type { VoiceRuntimeResources } from "./voice-types";

export class VoiceSidecarProcess {
  private child?: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<string, VoicePendingRequest>();
  private readonly decoder = new VoiceFrameDecoder();
  private closing = false;
  private failed = false;
  private closePromise?: Promise<void>;
  private exited?: Promise<void>;

  constructor(
    private readonly resources: VoiceRuntimeResources,
    private readonly onFrame: (frame: VoiceFrame) => void,
    private readonly onFailure: (code: string) => void,
    private readonly startupTimeoutMs = 30_000,
    private readonly operationTimeoutMs = 60_000,
  ) {}

  start = async (): Promise<void> => {
    if (this.child) throw new Error("voice_already_started");
    const child = spawn(this.resources.executablePath, this.resources.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.exited = new Promise<void>((resolve) => {
      child.once("close", () => {
        if (!this.closing && !this.failed) this.fail("voice_engine_exited");
        this.rejectPending("voice_engine_closed");
        resolve();
      });
    });
    child.on("error", () => this.fail("voice_engine_start_failed"));
    child.stdin.on("error", () => this.fail("voice_engine_write_failed"));
    // Engine diagnostics can contain paths. Drain without persisting or exposing them.
    child.stderr.resume();
    child.stdout.on("data", (chunk: Buffer) => {
      if (this.failed) return;
      try {
        for (const frame of this.decoder.push(chunk)) this.receive(frame);
      } catch {
        this.fail("voice_engine_protocol_error");
      }
    });
    child.stdout.on("end", () => {
      try {
        this.decoder.finish();
      } catch {
        this.fail("voice_engine_protocol_error");
      }
    });
    await this.send(
      { v: 1, id: randomUUID(), type: "configure", config: this.resources.configuration },
      "ready",
      this.startupTimeoutMs,
    );
  };

  send = (
    command: VoiceCommand,
    expected: "ready" | "completed" = "completed",
    timeoutMs = this.operationTimeoutMs,
  ): Promise<void> => {
    let encoded: string;
    try {
      encoded = encodeVoiceCommand(command);
      if (!this.child || this.failed || this.child.stdin.destroyed)
        throw new Error("voice_engine_unavailable");
      if (this.pending.has(command.id)) throw new Error("voice_duplicate_request");
      if (this.pending.size >= 64) throw new Error("voice_engine_overloaded");
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.fail("voice_engine_timeout"), timeoutMs);
      this.pending.set(command.id, { resolve, reject, timer, expected });
      this.child!.stdin.write(encoded, (error) => {
        if (error) this.fail("voice_engine_write_failed");
      });
    });
  };

  cancel = (targetId: string): void => {
    const pending = this.pending.get(targetId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(targetId);
      pending.reject(new Error("voice_cancelled"));
    }
    if (this.child && !this.failed && !this.closing)
      void this.send({ v: 1, id: randomUUID(), type: "cancel", targetId }).catch(() => {});
  };

  close = (): Promise<void> => {
    if (this.closePromise) return this.closePromise;
    this.closePromise = this.stop();
    return this.closePromise;
  };

  private stop = async (): Promise<void> => {
    this.closing = true;
    const child = this.child;
    if (!child) return;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const force = setTimeout(() => child.kill("SIGKILL"), 1_000);
    try {
      if (!this.failed)
        await this.send({ v: 1, id: randomUUID(), type: "close" }, "completed", 750).catch(
          () => {},
        );
      child.stdin.end();
      if (this.failed) child.kill("SIGTERM");
      await this.exited;
    } finally {
      clearTimeout(force);
      this.rejectPending("voice_engine_closed");
    }
  };

  private receive = (frame: VoiceFrame): void => {
    const pending = this.pending.get(frame.id);
    if (!pending) return;
    if (frame.type === "error") {
      clearTimeout(pending.timer);
      this.pending.delete(frame.id);
      pending.reject(new Error(frame.code));
      this.onFrame(frame);
      return;
    }
    if (frame.type === pending.expected) {
      clearTimeout(pending.timer);
      this.pending.delete(frame.id);
      pending.resolve();
    }
    this.onFrame(frame);
  };

  private rejectPending = (code: string): void => {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(code));
    }
    this.pending.clear();
  };

  private fail = (code: string): void => {
    if (this.failed) return;
    this.failed = true;
    this.rejectPending(code);
    this.child?.kill("SIGKILL");
    if (!this.closing) this.onFailure(code);
  };
}
