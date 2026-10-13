export type TraceMode = "metadata" | "content" | "stream";

export type TraceData =
  | null
  | boolean
  | number
  | string
  | TraceData[]
  | { [key: string]: TraceData };

export type TraceInput = {
  type: string;
  runId?: string;
  operationId?: string;
  parentOperationId?: string;
  data?: unknown;
};

export type TraceEvent = Omit<TraceInput, "data"> & {
  schemaVersion: 1;
  eventId: string;
  sessionId: string;
  seq: number;
  timestamp: string;
  data?: TraceData;
  payloadRef?: string;
};

export type TraceStatus = {
  mode: TraceMode;
  enabled: boolean;
  complete: boolean;
  queuedBytes: number;
  droppedEvents: number;
  lastWrittenSeq: number;
  error?: string;
};

export type TraceManifest = {
  format: "loop-trace";
  version: 1;
  sessionId: string;
  mode: TraceMode;
  startedAt: string;
  nextSeq: number;
  closedAt?: string;
  complete: boolean;
  droppedEvents: number;
  lastWrittenSeq: number;
  error?: string;
};

export type TraceOptions = {
  mode?: TraceMode;
  maxQueueBytes?: number;
  maxSessionBytes?: number;
  maxPayloadBytes?: number;
  segmentBytes?: number;
};
