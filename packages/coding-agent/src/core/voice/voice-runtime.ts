import { VoiceCall } from "./voice-call";
import type { VoiceCallOptions, VoiceRuntimeOptions } from "./voice-types";

export class VoiceRuntime {
  private call?: VoiceCall;
  private starting = false;
  private generation = 0;
  private startup?: Promise<void>;

  constructor(private readonly options: VoiceRuntimeOptions) {
    for (const timeout of [options.startupTimeoutMs, options.operationTimeoutMs]) {
      if (
        timeout !== undefined &&
        (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 2_147_483_647)
      )
        throw new Error("voice_invalid_timeout");
    }
  }

  get isActive(): boolean {
    return this.starting || !!this.call;
  }

  startCall = async (options: VoiceCallOptions): Promise<VoiceCall> => {
    if (this.isActive) throw new Error("voice_call_active");
    if (options.mode !== "dictation" && options.mode !== "conversation")
      throw new Error("voice_invalid_mode");
    this.starting = true;
    const generation = this.generation;
    const startup = Promise.withResolvers<void>();
    this.startup = startup.promise;
    try {
      const value = await this.options.resources(options);
      const lease = "resources" in value ? value : { resources: value, release: () => {} };
      if (generation !== this.generation) {
        lease.release();
        throw new Error("voice_call_closed");
      }
      const resources =
        options.synthesis === false
          ? {
              ...lease.resources,
              configuration: {
                asr: lease.resources.configuration.asr,
                vad: lease.resources.configuration.vad,
              },
            }
          : lease.resources;
      const call = new VoiceCall(options.mode, resources, this.options, () => {
        if (this.call === call) this.call = undefined;
        lease.release();
      });
      this.call = call;
      await call.start();
      return call;
    } finally {
      this.starting = false;
      startup.resolve();
    }
  };

  close = async (): Promise<void> => {
    this.generation++;
    await this.call?.close();
    await this.startup;
  };
}
