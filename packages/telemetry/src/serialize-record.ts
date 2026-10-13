import type { TraceEvent } from "./types";

export type SerializedTraceRecord = {
  seq: number;
  line: string;
  lineBytes: number;
  payload?: { reference: string; content: string; bytes: number };
};

/** Serialize content once; the writer uses these immutable bytes without revisiting the data. */
export const serializeTraceRecord = (
  event: TraceEvent,
  maxPayloadBytes: number,
): { record: SerializedTraceRecord; omitted: boolean } => {
  const { data, ...envelope } = event;
  let encoded: string | undefined = JSON.stringify(data);
  const dataBytes = encoded === undefined ? 0 : Buffer.byteLength(encoded);
  let payload: SerializedTraceRecord["payload"];
  let omitted = false;

  if (encoded !== undefined && dataBytes > 16 * 1024) {
    if (dataBytes > Math.min(maxPayloadBytes, 8 * 1024 * 1024)) {
      encoded = JSON.stringify({ omitted: true, reason: "payload_limit", bytes: dataBytes });
      omitted = true;
    } else {
      envelope.payloadRef = "payloads/" + event.eventId + ".json";
      payload = { reference: envelope.payloadRef, content: encoded, bytes: dataBytes };
      encoded = undefined;
    }
  }

  const header = JSON.stringify(envelope);
  const line =
    (encoded === undefined ? header : header.slice(0, -1) + ',"data":' + encoded + "}") + "\n";
  return {
    record: { seq: event.seq, line, lineBytes: Buffer.byteLength(line), payload },
    omitted,
  };
};
