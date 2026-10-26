import type { RawData } from "ws";

export type VoiceProxyTarget = {
  port: number;
  token: string;
};

export type VoiceProxyFrame = {
  data: RawData;
  binary: boolean;
};
