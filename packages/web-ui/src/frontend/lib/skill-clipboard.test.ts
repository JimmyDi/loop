import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { copySkillMessage, readSkillMessage } from "./skill-clipboard";

test("clipboard round trips exact skill identities without instructions or source paths", async () => {
  const window = new Window();
  const previous = globalThis.DOMParser;
  Object.assign(globalThis, { DOMParser: window.DOMParser });
  try {
    const skills = [
      {
        id: "a".repeat(24),
        name: "Review",
        content: "Private instructions",
        path: "skills/review",
      },
      { id: "b".repeat(24), name: "Review" },
    ];
    const copied = copySkillMessage("<script>text</script>\nNext line", skills);
    expect(copied.text).toBe("Review Review <script>text</script>\nNext line");
    expect(copied.html).not.toContain("<script>");
    expect(copied.html).not.toContain("Private instructions");
    expect(copied.html).not.toContain("skills/review");
    expect(readSkillMessage(copied.html!, copied.text)).toEqual({
      version: 1,
      text: "<script>text</script>\nNext line",
      skills: skills.map(({ id, name }) => ({ id, name })),
    });
    const skillOnly = copySkillMessage("", [skills[0]!]);
    expect(readSkillMessage(skillOnly.html!, skillOnly.text)?.text).toBe("");
    expect(copySkillMessage("plain", [])).toEqual({ text: "plain", html: undefined });
  } finally {
    Object.assign(globalThis, { DOMParser: previous });
    await window.happyDOM.close();
  }
});

test("foreign, altered, oversized and malformed clipboard metadata stays plain text", async () => {
  const window = new Window();
  const previous = globalThis.DOMParser;
  Object.assign(globalThis, { DOMParser: window.DOMParser });
  const skill = { id: "a".repeat(24), name: "Review" };
  try {
    const copied = copySkillMessage("Task", [skill]);
    expect(readSkillMessage(copied.html!, "Review Task edited")).toBeUndefined();
    expect(readSkillMessage("<strong>Review Task</strong>", copied.text)).toBeUndefined();
    expect(readSkillMessage(copied.html! + copied.html, copied.text)).toBeUndefined();
    expect(readSkillMessage("x".repeat(1_000_001), copied.text)).toBeUndefined();
    expect(
      readSkillMessage('<div data-loop-skill-message="%invalid">text</div>', "text"),
    ).toBeUndefined();
    for (const invalid of [
      { version: 2, text: "Task", skills: [skill] },
      { version: 1, text: 12, skills: [skill] },
      { version: 1, text: "Task", skills: [{ ...skill, id: "wrong" }] },
      { version: 1, text: "Task", skills: [{ ...skill, name: "" }] },
      { version: 1, text: "Task", skills: [skill, skill] },
      { version: 1, text: "Task", skills: Array.from({ length: 9 }, () => skill) },
    ]) {
      const html =
        '<div data-loop-skill-message="' +
        encodeURIComponent(JSON.stringify(invalid)) +
        '">Review Task</div>';
      expect(readSkillMessage(html, "Review Task")).toBeUndefined();
    }
  } finally {
    Object.assign(globalThis, { DOMParser: previous });
    await window.happyDOM.close();
  }
});
