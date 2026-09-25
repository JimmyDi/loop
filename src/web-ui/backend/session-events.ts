import type { Cursor, Frame, FrameBody, SessionSnapshot } from "../shared/protocol";

export class SessionEvents {
  readonly streamId = crypto.randomUUID();
  private seq = 0;
  private buffer: { frame: Frame; bytes: number }[] = [];
  private bytes = 0;
  private listeners = new Set<(frame: Frame) => void>();
  private closers = new Set<() => void>();

  constructor(
    private readonly sessionId: string,
    private readonly snapshot: () => SessionSnapshot,
    private readonly capacity = 256,
    private readonly byteLimit = 4 * 1024 * 1024,
  ) {}

  publish(body: FrameBody): void {
    const frame = structuredClone({
      ...body,
      sessionId: this.sessionId,
      streamId: this.streamId,
      seq: ++this.seq,
    });
    const bytes = new TextEncoder().encode(JSON.stringify(frame)).byteLength;

    this.buffer.push({ frame, bytes });
    this.bytes += bytes;

    while (this.buffer.length > this.capacity || this.bytes > this.byteLimit) {
      this.bytes -= this.buffer.shift()!.bytes;
    }

    for (const listener of this.listeners) listener(frame);
  }

  connect(listener: (frame: Frame) => void, cursor?: Cursor, onClose = () => {}): () => void {
    // No await between the snapshot/replay boundary and live subscription.
    const replayable =
      cursor?.streamId === this.streamId &&
      cursor.seq < this.seq &&
      cursor.seq >= (this.buffer[0]?.frame.seq ?? this.seq + 1) - 1;

    if (cursor && replayable) {
      for (const { frame } of this.buffer) {
        if (frame.seq > cursor.seq) listener(frame);
      }
    } else {
      listener({
        type: "session.snapshot",
        sessionId: this.sessionId,
        streamId: this.streamId,
        seq: this.seq,
        snapshot: structuredClone(this.snapshot()),
      });
    }

    this.listeners.add(listener);
    this.closers.add(onClose);

    return () => {
      this.listeners.delete(listener);
      this.closers.delete(onClose);
    };
  }

  close(): void {
    for (const close of this.closers) close();

    this.closers.clear();
    this.listeners.clear();
  }
}
