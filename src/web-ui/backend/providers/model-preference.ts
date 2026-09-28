import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { isModelEffort } from "../../../coding-agent/index";
import type { ModelSelection } from "../../shared/protocol";

type Selection = ModelSelection;

export class ModelPreference {
  value?: Selection;
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async load(): Promise<void> {
    try {
      const value = await Bun.file(this.file).json();
      this.value =
        typeof value?.provider === "string" && typeof value?.id === "string"
          ? {
              provider: value.provider,
              id: value.id,
              ...(isModelEffort(value.effort) ? { effort: value.effort } : {}),
            }
          : undefined;
    } catch {
      this.value = undefined;
    }
  }

  save(value: Selection): Promise<void> {
    const operation = this.tail.then(() => this.write(value));
    this.tail = operation.catch(() => {});
    return operation;
  }

  private async write(value: Selection): Promise<void> {
    const temporary = this.file + "." + crypto.randomUUID() + ".tmp";
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(value));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, this.file);
      this.value = { ...value };
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
}
