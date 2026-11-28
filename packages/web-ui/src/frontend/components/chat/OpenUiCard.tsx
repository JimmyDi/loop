import { BuiltinActionType, createParser, Renderer } from "@openuidev/react-lang";
import { type ReactNode, useContext, useMemo, useState } from "react";

import { ThemeProvider, useSystemThemeMode } from "@openuidev/react-ui";

import { openUiLibrary } from "../../../shared/openui-library";
import { OpenUiActionContext, openUiSubmission, openUiActionUrl } from "../../lib/openui-actions";
import { useTheme } from "../../state/theme-store";
import "@openuidev/react-ui/layered/styles/index.css";
import { normalizeOpenUiMetricValues } from "./openui-metric-values";
import "./OpenUiCard.css";

const parser = createParser(openUiLibrary.toJSONSchema(), openUiLibrary.root);

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
  const prepared = useMemo(() => {
    if (/^\]\]>openui:/m.test(response)) return undefined;
    const source = streaming ? response : normalizeOpenUiMetricValues(response);
    const parsed = parser.parse(source);
    if (parsed.queryStatements.length || parsed.mutationStatements.length) return undefined;
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
  }, [response, streaming]);

  return prepared && failedResponse !== response ? (
    <ThemeProvider mode={theme === "system" ? systemTheme : theme} cssSelector=".loop-openui">
      <div className="loop-openui">
        <Renderer
          response={prepared.source}
          library={openUiLibrary}
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
              if (url) window.open(url, "_blank", "noopener,noreferrer");
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
