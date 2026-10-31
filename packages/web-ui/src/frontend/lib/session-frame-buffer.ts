import type { Frame } from "../../shared/protocol";

/** Only streaming drafts wait for a paint; every lifecycle boundary drains them first. */
export const sessionFrameBuffer = (
  apply: (frames: readonly Frame[]) => boolean,
  rejected: () => void,
  schedule: (callback: () => void) => number,
  cancel: (handle: number) => void,
) => {
  let pending: Frame[] = [];
  let handle: number | undefined;
  const flush = () => {
    if (handle !== undefined) cancel(handle);
    handle = undefined;
    const frames = pending;
    pending = [];
    if (frames.length && !apply(frames)) rejected();
  };
  return {
    push: (frame: Frame) => {
      pending.push(frame);
      if (
        frame.type !== "loop.event" ||
        frame.event.type !== "message_update" ||
        pending.length >= 128
      )
        flush();
      else if (handle === undefined) handle = schedule(flush);
    },
    flush,
    dispose: () => {
      if (handle !== undefined) cancel(handle);
      handle = undefined;
      pending = [];
    },
  };
};
