import { useEffect, useId, useRef, useState } from "react";

import { desktopReleasesUrl } from "../desktop-releases-url";
import type { DesktopTarget } from "../desktop-download";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./DesktopDownload.module.css";

export const DesktopDownload = () => {
  const { language } = useLanguage();
  const zh = language === "zh";
  const [open, setOpen] = useState(false);
  const [windows, setWindows] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const menuId = useId();
  useEffect(() => {
    setWindows(/Windows/i.test(navigator.userAgent));
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const download = async (target: DesktopTarget) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(false);
    try {
      const { latestDesktopDownload } = await import("../desktop-download");
      if (controller.signal.aborted) return;
      const url = await latestDesktopDownload(target, controller.signal);
      if (!controller.signal.aborted) window.location.assign(url);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const options: { target: DesktopTarget; title: string; requirement: string }[] = [
    {
      target: "darwin-aarch64",
      title: "macOS (Apple silicon)",
      requirement: zh ? "需要 macOS 14 或更高版本" : "Requires macOS 14 or later",
    },
    {
      target: "darwin-x86_64",
      title: "macOS (Intel)",
      requirement: zh ? "需要 macOS 14 或更高版本" : "Requires macOS 14 or later",
    },
    {
      target: "windows-x86_64",
      title: "Windows (64-bit)",
      requirement: zh
        ? "支持 Windows 10 / 11 · Intel / AMD x64"
        : "Windows 10 / 11 · Intel / AMD x64",
    },
  ];
  return (
    <div
      className={styles.download}
      ref={host}
      data-pointer-clear
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className={styles.control}>
        <button
          type="button"
          className={styles.primary}
          disabled={loading}
          aria-expanded={windows ? undefined : open}
          aria-controls={windows ? undefined : menuId}
          onClick={() => (windows ? void download("windows-x86_64") : setOpen(!open))}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
          </svg>
          {zh ? "下载" : "Download for"} {windows ? "Windows" : "macOS"}
        </button>
        <button
          ref={toggle}
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={zh ? "选择操作系统" : "Choose operating system"}
          onClick={() => setOpen(!open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && (
        <div id={menuId} className={styles.options}>
          {options.map((option) => (
            <button
              key={option.target}
              type="button"
              disabled={loading}
              onClick={() => void download(option.target)}
            >
              <span>{option.title}</span>
              <small>{option.requirement}</small>
            </button>
          ))}
        </div>
      )}
      <div className={styles.feedback} role="status" aria-live="polite">
        {loading && (zh ? "正在获取最新安装包…" : "Finding the latest installer…")}
        {error && (
          <>
            {zh ? "暂时无法获取安装包。" : "Unable to fetch the installer. "}
            <a href={desktopReleasesUrl}>{zh ? "前往发布页面" : "View releases"}</a>
          </>
        )}
      </div>
    </div>
  );
};
