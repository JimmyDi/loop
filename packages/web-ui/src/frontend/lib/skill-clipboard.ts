type ClipboardSkill = { id: string; name: string };

export type SkillClipboardMessage = {
  version: 1;
  text: string;
  skills: ClipboardSkill[];
};

const plainMessage = (message: SkillClipboardMessage) =>
  [...message.skills.map((skill) => skill.name), message.text].filter(Boolean).join(" ");

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const copySkillMessage = (text: string, skills: ClipboardSkill[]) => {
  const message: SkillClipboardMessage = {
    version: 1,
    text,
    skills: skills.map(({ id, name }) => ({ id, name })),
  };
  const plain = plainMessage(message);
  return {
    text: plain,
    html: skills.length
      ? `<div data-loop-skill-message="${encodeURIComponent(JSON.stringify(message))}" style="white-space: pre-wrap">${escapeHtml(plain)}</div>`
      : undefined,
  };
};

export const readSkillMessage = (
  html: string,
  plain: string,
): SkillClipboardMessage | undefined => {
  if (!html || html.length > 1_000_000) return;
  try {
    const document = new DOMParser().parseFromString(html, "text/html");
    const entries = document.querySelectorAll("[data-loop-skill-message]");
    if (entries.length !== 1) return;
    const entry = entries[0]!;
    const message = JSON.parse(decodeURIComponent(entry.getAttribute("data-loop-skill-message")!));
    if (
      message.version !== 1 ||
      typeof message.text !== "string" ||
      !Array.isArray(message.skills) ||
      !message.skills.length ||
      message.skills.length > 8 ||
      message.skills.some(
        (skill: ClipboardSkill) =>
          !skill ||
          typeof skill.id !== "string" ||
          !/^[a-f0-9]{24}$/.test(skill.id) ||
          typeof skill.name !== "string" ||
          !skill.name.trim() ||
          skill.name.length > 128,
      ) ||
      new Set(message.skills.map((skill: ClipboardSkill) => skill.id)).size !==
        message.skills.length
    )
      return;
    if (plainMessage(message) !== plain || entry.textContent !== plain) return;
    return {
      version: 1,
      text: message.text,
      skills: message.skills.map(({ id, name }: ClipboardSkill) => ({ id, name })),
    };
  } catch {
    return;
  }
};
