import type { SessionSnapshot, Message } from "./protocol";
import { projectTools } from "./tool-projection";

export const roundStart = (messages: readonly Message[], end = messages.length) => {
  let rounds = 0;
  for (let index = end - 1; index >= 0; index--) {
    if (messages[index]?.role === "user" && ++rounds === 3) return index;
  }
  return 0;
};

export const pageSnapshot = (snapshot: SessionSnapshot): SessionSnapshot => {
  const localStart = roundStart(snapshot.state.messages);
  const start = (snapshot.history?.start ?? 0) + localStart;
  const messages = snapshot.state.messages.slice(localStart);
  const tools = projectTools(messages);
  if (snapshot.state.draft) Object.assign(tools, projectTools([snapshot.state.draft]));
  for (const id of Object.keys(tools)) tools[id] = snapshot.tools[id] ?? tools[id]!;
  return {
    ...snapshot,
    history: {
      start,
      total: snapshot.history?.total ?? snapshot.state.messages.length,
      userStart:
        (snapshot.history?.userStart ?? 0) +
        snapshot.state.messages.slice(0, localStart).filter((message) => message.role === "user")
          .length,
    },
    state: { ...snapshot.state, messages },
    tools,
  };
};

export const mergeHistorySnapshot = (
  previous: SessionSnapshot | undefined,
  next: SessionSnapshot,
): SessionSnapshot => {
  if (
    !previous?.history ||
    !next.history ||
    previous.streamId !== next.streamId ||
    previous.history.start >= next.history.start
  )
    return next;
  const count = next.history.start - previous.history.start;
  if (count > previous.state.messages.length) return next;
  const messages = [...previous.state.messages.slice(0, count), ...next.state.messages];
  return {
    ...next,
    history: {
      ...next.history,
      start: previous.history.start,
      userStart: previous.history.userStart,
    },
    state: { ...next.state, messages },
    tools: { ...projectTools(messages), ...next.tools },
  };
};
