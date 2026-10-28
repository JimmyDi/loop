import type { SessionSnapshot } from "../../shared/protocol";
import type { VoiceNarrationRow } from "./narration-types";
import { voiceNarration } from "./narration-utils";

export class VoiceNarrationTracker {
  private minimum = 0;
  private seen = new Set<string>();

  reset(snapshot: SessionSnapshot): void {
    this.minimum = Math.max(
      snapshot.history?.start ?? 0,
      (snapshot.history?.total ?? snapshot.state.messages.length) - 8,
    );
    this.seen = new Set(voiceNarration(snapshot, this.minimum).map((row) => row.id));
  }

  next(snapshot: SessionSnapshot): VoiceNarrationRow[] {
    const rows = voiceNarration(snapshot, this.minimum);
    const next = rows.filter((row) => !this.seen.has(row.id));
    for (const row of rows) this.seen.add(row.id);
    return next.filter(
      (row) =>
        row.kind !== "toolStart" ||
        !next.some(
          (other) =>
            other.id.startsWith(row.id.slice(0, -"toolStart".length)) && other.kind !== "toolStart",
        ),
    );
  }
}
