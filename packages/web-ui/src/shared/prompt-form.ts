export type PromptForm = {
  name: string;
  fields: { name: string; label: string; value: unknown; displayText: string }[];
};

const prefix = "Submitted form data (user input):\n";
const maxBytes = 24 * 1024;

export const validPromptForm = (value: unknown): value is PromptForm => {
  if (!value || typeof value !== "object") return false;
  const { name, fields } = value as Partial<PromptForm>;
  return (
    typeof name === "string" &&
    !!name &&
    Array.isArray(fields) &&
    fields.length > 0 &&
    fields.every(
      (field) =>
        field &&
        typeof field.name === "string" &&
        typeof field.label === "string" &&
        typeof field.displayText === "string" &&
        Object.hasOwn(field, "value") &&
        field.value !== undefined,
    ) &&
    new TextEncoder().encode(JSON.stringify(value)).length <= maxBytes
  );
};

export const formContent = (form: PromptForm): string => prefix + JSON.stringify(form);

export const readFormContent = (text: string): PromptForm | undefined => {
  if (!text.startsWith(prefix) || text.length > prefix.length + maxBytes) return;
  try {
    const form: unknown = JSON.parse(text.slice(prefix.length));
    if (validPromptForm(form)) return form;
  } catch {
    // Leave ordinary or malformed text visible.
  }
};
