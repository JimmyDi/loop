import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { i18n } from "../../i18n/setup";
import { VoiceSettings } from "./VoiceSettings";

test("remote settings describe local management and disable installation", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: false,
    localManagement: false,
    phase: "idle",
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  expect(html).toContain("computer running Loop");
  expect(html).toContain("Recordings are not saved");
  expect(html).toContain("Phone audio travels through");
  for (const name of ["Download", "Update", "Uninstall"])
    expect(html).toMatch(new RegExp('<button[^>]*aria-label="' + name + '"[^>]*disabled=""'));
  client.clear();
});

test("remote input-only installation can choose voice input and test the microphone", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: true,
    ttsInstalled: false,
    localManagement: false,
    engineAvailable: true,
    phase: "idle",
  });
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <VoiceSettings />
      </QueryClientProvider>,
    );
    const profile = view.getByRole("combobox", {
      name: i18n.t("voice.chooseProfile"),
    }) as HTMLSelectElement;
    expect(profile.disabled).toBe(false);
    expect(
      (view.getByRole("button", { name: i18n.t("voice.microphone") }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(profile, { target: { value: "input" } });
    expect(profile.value).toBe("input");
    expect(
      (view.getByRole("button", { name: i18n.t("voice.microphone") }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (view.getByRole("button", { name: i18n.t("voice.preview") }) as HTMLButtonElement).disabled,
    ).toBe(true);
    for (const name of ["repair", "update", "uninstall"])
      expect(
        (view.getByRole("button", { name: i18n.t("voice." + name) }) as HTMLButtonElement).disabled,
      ).toBe(true);
    expect(view.getAllByRole("listitem")).toHaveLength(3);
    expect(view.getByRole("alert").closest("li")).toBe(view.getAllByRole("listitem")[1]);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("installed components retain a repair action when no update is available", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: true,
    ttsInstalled: true,
    localManagement: true,
    engineAvailable: true,
    updateAvailable: false,
    phase: "idle",
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  const repair = html.match(/<button[^>]*aria-label="Verify and repair"[^>]*>/)?.[0];
  expect(repair).toBeDefined();
  expect(repair).not.toContain("disabled");
  expect(html).toMatch(/<button[^>]*aria-label="Update"[^>]*disabled=""/);
  expect(html).toContain("locally imported engine");
  client.clear();
});

test("unpublished engines show a specific reason and disable download without microphone errors", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: false,
    localManagement: true,
    engineAvailable: false,
    phase: "error",
    error: "voice_engine_unavailable",
    components: [
      {
        id: "engine",
        kind: "engine",
        name: "Local engine",
        version: "1",
        installed: false,
        downloadBytes: 0,
        requiredBytes: 0,
        installedBytes: 0,
        license: "MIT",
      },
    ],
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  expect(html).toContain("has not been published");
  expect(html).toContain("Not published");
  expect(html).not.toContain("Check microphone permission");
  expect(html).toContain("Currently on disk");
  expect(html).toContain("Installed size");
  expect(html.match(/Not published/g)).toHaveLength(2);
  expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(4);
  client.clear();
});

test("uninstalled models show download and installed size before occupying disk space", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: false,
    localManagement: true,
    phase: "idle",
    components: [
      {
        id: "asr",
        name: "Recognition model",
        kind: "asr",
        version: "1",
        installed: false,
        downloadBytes: 1048576,
        requiredBytes: 3145728,
        installedBytes: 0,
        license: "MIT",
      },
    ],
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  expect(html).toContain("Download: 1 MiB");
  expect(html).toContain("Installed size: 3 MiB");
  expect(html).toContain("Currently on disk: 0 MiB");
  client.clear();
});

test("damaged activation and partial caches remain uninstallable without relaxing local or activity gates", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const status = {
    supported: true,
    installed: false,
    localManagement: true,
    engineAvailable: false,
    phase: "error",
    error: "voice_resource_integrity_failed",
    components: [
      {
        id: "asr-cache",
        name: "Cached recognition model",
        kind: "asr",
        version: "1",
        installed: true,
        downloadBytes: 10,
        installedBytes: 10,
        license: "MIT",
      },
    ],
  };
  const uninstall = (value: typeof status) => {
    client.setQueryData(["voice-status"], value);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <VoiceSettings />
      </QueryClientProvider>,
    );
    return html.match(/<button[^>]*aria-label="Uninstall"[^>]*>/)?.[0];
  };
  expect(uninstall(status)).toBeDefined();
  expect(uninstall(status)).not.toContain("disabled");
  expect(uninstall({ ...status, localManagement: false })).toContain("disabled");
  expect(uninstall({ ...status, supported: false })).toContain("disabled");
  expect(uninstall({ ...status, phase: "installing" })).toContain("disabled");
  client.clear();
});
