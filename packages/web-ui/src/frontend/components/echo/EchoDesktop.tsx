import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import "./EchoDesktop.css";

export const EchoDesktop = ({
  computerId,
  state,
  onClose,
}: {
  computerId: string;
  state: string;
  onClose(): void;
}) => {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [image, setImage] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    setImage(undefined);
    setError(false);
    if (state !== "running") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let previous: string | undefined;
    const refresh = async () => {
      try {
        const response = await fetch(
          "/api/echo/computers/" + encodeURIComponent(computerId) + "/preview",
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        const next = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted) {
          URL.revokeObjectURL(next);
          return;
        }
        setImage(next);
        setError(false);
        if (previous) URL.revokeObjectURL(previous);
        previous = next;
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 1500);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (previous) URL.revokeObjectURL(previous);
    };
  }, [computerId, state]);
  return (
    <aside className="echo-desktop" aria-label={zh ? "沙盒桌面" : "Sandbox desktop"}>
      <header className="echo-desktop-header">
        <h2>{zh ? "沙盒桌面" : "Sandbox desktop"}</h2>
        <button type="button" onClick={onClose} aria-label={zh ? "关闭桌面" : "Close desktop"}>
          ×
        </button>
      </header>
      {state === "running" ? (
        <>
          {image ? <img src={image} alt="Echo desktop" /> : null}
          {error && <p role="status">{image ? "Desktop reconnecting…" : "Desktop unavailable"}</p>}
          {!image && !error && <p role="status">Loading desktop…</p>}
        </>
      ) : (
        <p role="status">
          {zh ? "电脑已停止，请点击上方「启动」" : "Computer stopped. Select Start above."}
        </p>
      )}
    </aside>
  );
};
