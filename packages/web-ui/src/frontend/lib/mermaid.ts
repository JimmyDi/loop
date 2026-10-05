import DOMPurify from "dompurify";

let renderQueue: Promise<unknown> = Promise.resolve();
let nextId = 0;

export const renderMermaid = (
  source: string,
  dark: boolean,
  signal: AbortSignal,
): Promise<string> => {
  const render = async (): Promise<string> => {
    signal.throwIfAborted();

    // Match Mermaid's input limit without replacing the source with an error diagram.
    if (source.length > 50_000) throw new Error("Mermaid source exceeds the rendering limit.");

    const { default: mermaid } = await import("mermaid");
    signal.throwIfAborted();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme: dark ? "dark" : "default",
      htmlLabels: false,
      maxTextSize: 50_000,
      maxEdges: 500,
      secure: [
        "secure",
        "securityLevel",
        "startOnLoad",
        "suppressErrorRendering",
        "maxTextSize",
        "maxEdges",
        "htmlLabels",
        "dompurifyConfig",
        "theme",
        "themeVariables",
        "themeCSS",
        "fontFamily",
      ],
    });

    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText =
      "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
    document.body.append(container);

    try {
      const { svg } = await mermaid.render(`loop-mermaid-${++nextId}`, source, container);
      signal.throwIfAborted();
      // Never bind diagram callbacks or allow generated SVG to weaken Markdown's HTML policy.
      return DOMPurify(window).sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ["a", "foreignObject", "animate", "animateMotion", "animateTransform", "set"],
      });
    } finally {
      container.remove();
    }
  };

  // Initialization is global: serialize it with rendering so concurrent themes cannot race.
  const result = renderQueue.then(render);
  renderQueue = result.catch(() => undefined);
  return result;
};
