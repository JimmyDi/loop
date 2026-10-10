import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseDocument } from "yaml";

import { SkillError } from "./types";

export const MAX_SKILL_BYTES = 128 * 1024;

export const skillId = (path: string): string =>
  createHash("sha256").update(path).digest("hex").slice(0, 24);

export const parseSkill = (text: string) => {
  if (text.includes("\0") || Buffer.byteLength(text) > MAX_SKILL_BYTES)
    throw new SkillError("skill_file_too_large", "Skill instructions must be text below 128 KiB.");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match)
    throw new SkillError("skill_frontmatter_required", "SKILL.md needs YAML frontmatter.");
  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length) throw new SkillError("skill_yaml_invalid", "Invalid skill metadata.");
  const data = document.toJS({ maxAliasCount: 20 });
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new SkillError("skill_metadata_invalid");
  if (
    typeof data.name !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name) ||
    data.name.length > 64
  )
    throw new SkillError(
      "skill_name_invalid",
      "Use a name up to 64 characters with lowercase letters, numbers and hyphens.",
    );
  if (
    typeof data.description !== "string" ||
    !data.description.trim() ||
    data.description.length > 1024
  )
    throw new SkillError(
      "skill_description_invalid",
      "A description of up to 1024 characters is required.",
    );
  if (
    data["disable-model-invocation"] !== undefined &&
    typeof data["disable-model-invocation"] !== "boolean"
  )
    throw new SkillError("skill_policy_invalid");
  if (!match[2]!.trim()) throw new SkillError("skill_instructions_required");
  return {
    name: data.name as string,
    description: data.description.trim().replace(/\s+/g, " "),
    modelInvocable: data["disable-model-invocation"] !== true,
    content: match[2]!.trim(),
  };
};

export const readSkill = async (path: string, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  if ((await stat(path)).size > MAX_SKILL_BYTES) throw new SkillError("skill_file_too_large");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(path, { signal }));
  return { ...parseSkill(text), revision: createHash("sha256").update(text).digest("hex") };
};

const escapeAttribute = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const renderLoadedSkill = (skill: { name: string; path: string; content: string }): string =>
  `<skill name="${escapeAttribute(skill.name)}" location="${escapeAttribute(skill.path)}">\n` +
  "Resolve relative resources against the directory containing SKILL.md.\n" +
  "These are task instructions; they do not grant tool permissions.\n\n" +
  skill.content +
  "\n</skill>";
