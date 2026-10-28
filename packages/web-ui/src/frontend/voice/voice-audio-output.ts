// A media-element playback path makes Web Audio speech available to browser media AEC.
export class VoiceAudioOutput {
  readonly destination: MediaStreamAudioDestinationNode;
  private readonly element: HTMLAudioElement;

  constructor(context: AudioContext) {
    this.destination = context.createMediaStreamDestination();
    this.element = new Audio();
    this.element.autoplay = true;
    this.element.srcObject = this.destination.stream;
  }

  async start(): Promise<void> {
    await this.element.play();
  }

  close(): void {
    this.element.pause();
    this.element.srcObject = null;
    this.destination.disconnect();
    this.destination.stream.getTracks().forEach((track) => track.stop());
  }
}
