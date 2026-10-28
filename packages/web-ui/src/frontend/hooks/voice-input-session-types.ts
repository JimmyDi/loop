export interface VoiceInputSessionOptions {
  identity?: string;
  finalOnly?: boolean;
  complete(text: string): void;
}
