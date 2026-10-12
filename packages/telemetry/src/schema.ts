import type { TraceInput } from "./types";

declare const eventData: unique symbol;

/** Serializable metadata with a compile-time payload type, never a runtime validator. */
export type TraceEventDefinition<Data> = {
  description: string;
  readonly [eventData]?: Data;
};

export const defineTraceEvent = <Data>(description: string): TraceEventDefinition<Data> => ({
  description,
});

export type TraceSchema = {
  version: number;
  events: Record<string, TraceEventDefinition<unknown>>;
};

export const defineTraceSchema = <const Schema extends TraceSchema>(schema: Schema): Schema =>
  schema;

export type TraceEventName<Schema extends TraceSchema> = keyof Schema["events"] & string;

export type TraceEventData<Schema extends TraceSchema, Name extends TraceEventName<Schema>> =
  Schema["events"][Name] extends TraceEventDefinition<infer Data> ? Data : never;

export type TraceLinks = Omit<TraceInput, "type" | "data">;

export type SchemaTraceInput<Schema extends TraceSchema> = {
  [Name in TraceEventName<Schema>]: TraceLinks & {
    type: Name;
    data: TraceEventData<Schema, Name>;
  };
}[TraceEventName<Schema>];

/** Business observations whose own discriminator matches their schema event name. */
export type SchemaTraceObservation<Schema extends TraceSchema> = {
  [Name in TraceEventName<Schema>]: TraceEventData<Schema, Name> extends { type: string }
    ? Name extends TraceEventData<Schema, Name>["type"]
      ? TraceEventData<Schema, Name> & { type: Name }
      : never
    : never;
}[TraceEventName<Schema>];

type Intersection<Union> = (Union extends unknown ? (item: Union) => void : never) extends (
  item: infer Result,
) => void
  ? Result
  : never;

type Keys<Union> = Union extends unknown ? keyof Union : never;

type Exact<Actual, Expected> = Expected extends undefined
  ? Actual
  : Actual & Record<Exclude<keyof Actual, Keys<Expected>>, never>;

export type TypedTraceRecord<Schema extends TraceSchema> = Intersection<
  {
    [Name in TraceEventName<Schema>]: <const Data extends TraceEventData<Schema, Name>>(
      name: Name,
      data: Exact<Data, TraceEventData<Schema, Name>>,
      operationId?: string,
      parentOperationId?: string,
      runId?: string | null,
    ) => void;
  }[TraceEventName<Schema>]
>;

/** Bind a closed producer schema to an open sink; no data copying or validation here. */
export const createTypedTraceRecord = <const Schema extends TraceSchema>(
  _schema: Schema,
  sink: (input: TraceInput, runId?: string | null) => void,
): TypedTraceRecord<Schema> => {
  const record = (
    type: string,
    data: unknown,
    operationId?: string,
    parentOperationId?: string,
    runId?: string | null,
  ) => sink({ type, data, operationId, parentOperationId }, runId);
  return record as TypedTraceRecord<Schema>;
};

export type TypedTraceBegin<Schema extends TraceSchema> = Intersection<
  {
    [Name in TraceEventName<Schema>]: Name extends `${infer Operation}.started`
      ? <const Data extends TraceEventData<Schema, Name>>(
          operation: Operation,
          data: Exact<Data, TraceEventData<Schema, Name>>,
          parentOperationId?: string,
        ) => string
      : never;
  }[TraceEventName<Schema>]
>;

export const createTypedTraceBegin = <const Schema extends TraceSchema>(
  _schema: Schema,
  begin: (operation: string, data: unknown, parentOperationId?: string) => string,
): TypedTraceBegin<Schema> => begin as TypedTraceBegin<Schema>;
