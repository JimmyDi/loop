import { getInitialLanguage } from "../i18n/language";
import { pairingEn } from "../i18n/pairing-en";
import { pairingZh } from "../i18n/pairing-zh";
import { readPreference } from "../lib/preferences";

export const remoteBootstrapView = (document: Document) => {
  const language = getInitialLanguage();
  const labels = language === "zh" ? pairingZh : pairingEn;
  const theme = readPreference("theme", "system");
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = ["light", "dark"].includes(theme) ? theme : "system";
  for (const node of document.querySelectorAll<HTMLElement>("[data-label]")) {
    const key = node.dataset.label as keyof typeof labels;
    node.textContent = labels[key];
  }
  const form = document.querySelector<HTMLFormElement>(".remote-bootstrap form")!;
  const input = form.querySelector<HTMLInputElement>("input")!;
  const submit = form.querySelector<HTMLButtonElement>("button")!;
  const status = document.querySelector<HTMLElement>("[data-pairing-status]")!;
  const loading = document.querySelector<HTMLElement>("[data-loading]")!;
  const caption = status.querySelector<HTMLElement>("[data-status]")!;
  const code = status.querySelector<HTMLElement>("[data-code]")!;
  const compare = status.querySelector<HTMLElement>("[data-label=compare]")!;
  const error = document.querySelector<HTMLElement>('[role="alert"]')!;
  const retry = document.querySelector<HTMLButtonElement>("[data-retry]")!;
  return {
    form,
    input,
    retry,
    busy: (value: boolean) => {
      submit.disabled = value;
    },
    status: (key?: keyof typeof labels, confirmation?: string) => {
      const opening = key === "checking" || key === "opening";
      document.documentElement.toggleAttribute("data-pairing", !opening);
      if (opening) loading.textContent = labels[key];
      form.hidden = !!key;
      status.hidden = !key;
      caption.textContent = key ? labels[key] : "";
      code.textContent = confirmation ?? "";
      compare.hidden = !confirmation;
    },
    error: (key?: keyof typeof labels) => {
      if (key) document.documentElement.setAttribute("data-pairing", "");
      error.textContent = key ? labels[key] : "";
      error.hidden = !key;
      retry.hidden = !key;
    },
  };
};
