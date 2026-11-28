import {
  BuiltinActionType,
  createParser,
  createStreamingParser,
  Renderer,
} from "@openuidev/react-lang";
import { type ReactNode, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ThemeProvider, useSystemThemeMode } from "@openuidev/react-ui";

import { openUiLibrary } from "../../lib/openui-render-library";
import { demoSalesQuery, openUiQueries } from "../../../shared/openui-sales-data";
import {
  OpenUiActionContext,
  openUiSubmission,
  openUiActionUrl,
  openUiExternalLink,
} from "../../lib/openui-actions";
import { useTheme } from "../../state/theme-store";
import "@openuidev/react-ui/layered/styles/index.css";
import { normalizeOpenUiCardGap } from "./openui-card-gap";
import { normalizeOpenUiIdentifiers } from "./openui-identifiers";
import { normalizeOpenUiMetricValues } from "./openui-metric-values";
import { normalizeOpenUiStackGap } from "./openui-stack-gap";
import "./OpenUiCard.css";

const schema = openUiLibrary.toJSONSchema();
const parser = createParser(schema, openUiLibrary.root);

const OpenUiCard = ({
  response,
  streaming,
  fallback,
}: {
  response: string;
  streaming: boolean;
  fallback: ReactNode;
}) => {
  const [failedResponse, setFailedResponse] = useState<string>();
  const send = useContext(OpenUiActionContext);
  const theme = useTheme((state) => state.theme);
  const systemTheme = useSystemThemeMode();
  const streamingParser = useMemo(
    () => (streaming ? createStreamingParser(schema, openUiLibrary.root) : undefined),
    [streaming],
  );
  const candidate = useMemo(() => {
    if (/^\]\]>openui:/m.test(response)) return undefined;
    const normalized = normalizeOpenUiIdentifiers(response);
    const source = streaming
      ? normalized
      : normalizeOpenUiMetricValues(normalizeOpenUiCardGap(normalizeOpenUiStackGap(normalized)));
    const parsed = streamingParser ? streamingParser.set(source) : parser.parse(source);
    if (
      parsed.mutationStatements.length ||
      parsed.queryStatements.some(
        ({ toolAST, refreshAST }) =>
          toolAST?.k !== "Str" || toolAST.v !== demoSalesQuery || refreshAST !== null,
      )
    )
      return undefined;
    if (streaming && !parsed.root && !parsed.rootExpression) return undefined;
    // The parser already drops extra positional arguments.
    if (
      !streaming &&
      ((!parsed.root && !parsed.rootExpression) ||
        parsed.meta.incomplete ||
        parsed.meta.unresolved.length ||
        parsed.meta.errors.some(
          (error) => error.severity !== "warning" && error.code !== "excess-args",
        ))
    )
      return undefined;
    return { parsed, source };
  }, [response, streaming, streamingParser]);

  // A partial query can temporarily fail the allowlist check while its name streams in.
  const lastPreview = useRef<{ response: string; card: NonNullable<typeof candidate> }>(undefined);
  useLayoutEffect(() => {
    if (!streaming) lastPreview.current = undefined;
    else if (candidate) lastPreview.current = { response, card: candidate };
    else if (lastPreview.current && !response.startsWith(lastPreview.current.response))
      lastPreview.current = undefined;
  }, [candidate, response, streaming]);

  const preview = lastPreview.current;
  const prepared =
    candidate ??
    (streaming && preview && response.startsWith(preview.response) ? preview.card : undefined);

  return prepared && failedResponse !== response ? (
    <ThemeProvider mode={theme === "system" ? systemTheme : theme} cssSelector=".loop-openui">
      <div className="loop-openui">
        <Renderer
          response={prepared.source}
          library={openUiLibrary}
          toolProvider={openUiQueries}
          isStreaming={streaming}
          onError={(errors) => {
            if (!streaming && errors.some((error) => error.source === "runtime")) {
              setFailedResponse(response);
            }
          }}
          onAction={(event) => {
            if (streaming) return;
            if (event.type === BuiltinActionType.OpenUrl) {
              const url = openUiActionUrl(event.params.url);
              if (url) openUiExternalLink(url);
            } else if (event.type === BuiltinActionType.ContinueConversation) {
              const submission = openUiSubmission(event, prepared.parsed.root ?? undefined);
              if (submission) void send?.(submission);
            }
          }}
        />
      </div>
    </ThemeProvider>
  ) : (
    fallback
  );
};

export default OpenUiCard;
