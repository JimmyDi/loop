import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { expect, test, vi } from "vitest";

import { SkillInstaller } from "./installer";

test("conflicts never replace existing files; failed updates roll back and cancel aborts downloads", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "loop-installer-")));
  const installer = new SkillInstaller();
  const main = "---\nname: example\ndescription: Review source\n---\nOriginal body.";
  const ready = async (content = main) => {
    const job = installer.preview({ kind: "created", content });
    await vi.waitFor(() => expect(installer.get(job.id).status).toBe("ready"));
    return job.id;
  };
  try {
    await installer.install(await ready(), ["created"], "personal", root, async () => {});
    await expect(
      installer.install(await ready(), ["created"], "personal", root, async () => {}),
    ).rejects.toThrow("already exists");
    await expect(
      installer.install(
        await ready(main.replace("Original", "New")),
        ["created"],
        "personal",
        root,
        async () => {
          throw new Error("record failed");
        },
        join(root, "example"),
      ),
    ).rejects.toThrow("record failed");
    expect(await readFile(join(root, "example/SKILL.md"), "utf8")).toBe(main);
    expect(await readdir(root)).toEqual(["example"]);
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), {
            once: true,
          });
        }),
    );
    try {
      const job = installer.preview({
        kind: "github",
        location: "https://github.com/example/skills",
      });
      installer.cancel(job.id);
      await installer.close();
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      fetch.mockRestore();
    }
  } finally {
    await installer.close();
    await rm(root, { recursive: true, force: true });
  }
});
