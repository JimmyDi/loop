import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { latestDesktopDownload } from "../desktop-download";
import { DesktopDownload } from "./DesktopDownload";

vi.mock("../desktop-download", () => ({
  desktopReleasesUrl: "https://github.com/JimmyDi/loop/releases",
  latestDesktopDownload: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test("shows platform requirements and dismisses with Escape or outside pointer", () => {
  render(<DesktopDownload />);
  const toggle = screen.getByRole("button", { name: "选择操作系统" });
  fireEvent.click(toggle);
  expect(screen.getByRole("button", { name: /macOS \(Apple silicon\).*macOS 14/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /macOS \(Intel\)/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Windows.*Windows 10 \/ 11/ })).toBeTruthy();
  fireEvent.keyDown(toggle, { key: "Escape" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  fireEvent.pointerDown(document.body);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

test("downloads the selected architecture and offers a fallback on failure", async () => {
  vi.mocked(latestDesktopDownload).mockRejectedValue(new Error("unavailable"));
  render(<DesktopDownload />);
  fireEvent.click(screen.getByRole("button", { name: "选择操作系统" }));
  fireEvent.click(screen.getByRole("button", { name: /macOS \(Intel\)/ }));
  await waitFor(() => expect(screen.getByRole("link", { name: "前往发布页面" })).toBeTruthy());
  expect(latestDesktopDownload).toHaveBeenCalledWith("darwin-x86_64", expect.any(AbortSignal));
});

test("offers Windows directly on Windows and navigates to the resolved asset", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Windows NT 10.0; Win64; x64");
  const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
  vi.mocked(latestDesktopDownload).mockResolvedValue(
    "https://github.com/JimmyDi/loop/releases/download/desktop-v0.9.1/windows-x86_64-Loop_0.9.1_x64-setup.exe",
  );
  render(<DesktopDownload />);
  fireEvent.click(screen.getByRole("button", { name: "下载 Windows" }));
  await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
  expect(latestDesktopDownload).toHaveBeenCalledWith("windows-x86_64", expect.any(AbortSignal));
});
