import { createContext } from "react";
import type { ActionEvent, ElementNode } from "@openuidev/react-lang";

import { validPromptForm } from "../../shared/prompt-form";
import type { PromptForm } from "../../shared/prompt-form";

type OpenUiSubmission = { text: string; form?: PromptForm };

export const OpenUiActionContext = createContext<
  ((submission: OpenUiSubmission) => Promise<void>) | undefined
>(undefined);

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const element = (value: unknown): ElementNode | undefined => {
  const node = record(value);
  return node?.type === "element" && typeof node.typeName === "string" && record(node.props)
    ? (value as ElementNode)
    : undefined;
};

const findForm = (value: unknown, name: string): ElementNode | undefined => {
  const node = element(value);
  if (node?.typeName === "Form" && node.props.name === name) return node;
  const children = Array.isArray(value) ? value : Object.values(node?.props ?? {});
  for (const child of children) {
    const form = findForm(child, name);
    if (form) return form;
  }
};

const displayValue = (value: unknown, input?: ElementNode): string => {
  const items = input?.props.items;
  const options = new Map<string, string>();
  if (Array.isArray(items)) {
    for (const item of items) {
      const props = element(item)?.props;
      const key = props?.value ?? props?.name;
      const label = props?.label ?? props?.title;
      if (typeof key === "string" && typeof label === "string") options.set(key, label);
    }
  }
  const label = (item: unknown) =>
    typeof item === "string" ? (options.get(item) ?? item) : (JSON.stringify(item) ?? "");
  if (Array.isArray(value)) return value.map(label).join(", ");
  const fields = record(value);
  if (fields && options.size) {
    return Object.entries(fields)
      .map(([key, selected]) => (options.get(key) ?? key) + ": " + label(selected))
      .join(", ");
  }
  return label(value);
};

export const openUiSubmission = (
  action: ActionEvent,
  root?: ElementNode,
): OpenUiSubmission | undefined => {
  const text = action.humanFriendlyMessage.trim();
  if (!text || text.length > 24 * 1024) return;
  const formName = action.formName;
  const fields = formName ? record(action.formState?.[formName]) : undefined;
  if (!formName || !fields || !Object.keys(fields).length) return { text };
  const form = findForm(root, formName);
  const controls = new Map<string, { label: string; input: ElementNode }>();
  if (Array.isArray(form?.props.fields)) {
    for (const field of form.props.fields) {
      const control = element(field);
      if (control?.typeName !== "FormControl") continue;
      const input = element(control.props.input);
      const label = control.props.label;
      if (input && typeof input.props.name === "string" && typeof label === "string") {
        controls.set(input.props.name, { label, input });
      }
    }
  }
  const submittedFields = Object.entries(fields).map(([name, field]) => {
    const entry = record(field);
    const value = entry && "componentType" in entry && "value" in entry ? entry.value : field;
    const control = controls.get(name);
    return {
      name,
      label: control?.label || name,
      value: value ?? null,
      displayText: displayValue(value, control?.input),
    };
  });
  const submission = { name: formName, fields: submittedFields };
  if (validPromptForm(submission)) return { text, form: submission };
};

export const openUiActionUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const url = URL.parse(value);
  return url &&
    (url.protocol === "https:" || url.protocol === "http:") &&
    !url.username &&
    !url.password
    ? url.href
    : undefined;
};

// A real anchor also goes through the desktop webview's external navigation handler.
export const openUiExternalLink = (url: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
};
