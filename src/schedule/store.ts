import { join } from "node:path";
import { JsonStore } from "../storage/json-store";

export type ScheduleTask = {
  id: string;
  name: string;
  cron: string;
  prompt: string;
  provider?: string;
  model?: string;
  enabled: boolean;
  lastRun?: { status: "completed" | "failed"; output?: string; at: string };
  updatedAt: string;
};

const validCron = (cron: string) => cron.trim().split(/\s+/).length === 5;

export class ScheduleStore {
  private readonly store: JsonStore<ScheduleTask[]>;

  constructor(dataDir = process.env.LOOP_DATA_DIR ?? ".loop") {
    this.store = new JsonStore(join(dataDir, "schedules.json"), []);
  }

  async list() {
    return this.store.read();
  }

  async create(
    name: string,
    cron: string,
    prompt: string,
    options: Pick<ScheduleTask, "provider" | "model"> = {},
  ) {
    if (!name.trim() || !prompt.trim() || !validCron(cron))
      throw new Error("name, prompt and a five-field cron expression are required");
    const item: ScheduleTask = {
      id: crypto.randomUUID(),
      name,
      cron,
      prompt,
      ...options,
      enabled: true,
      updatedAt: new Date().toISOString(),
    };
    await this.store.update((items) => [...items, item]);
    return item;
  }

  async setEnabled(id: string, enabled: boolean) {
    const next = await this.store.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled, updatedAt: new Date().toISOString() } : item,
      ),
    );
    return next.find((item) => item.id === id) ?? null;
  }

  async remove(id: string) {
    const before = await this.list();
    await this.store.write(before.filter((item) => item.id !== id));
    return before.length !== (await this.list()).length;
  }

  async recordRun(id: string, status: "completed" | "failed", output?: string) {
    const next = await this.store.update((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              lastRun: { status, output, at: new Date().toISOString() },
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    return next.find((item) => item.id === id) ?? null;
  }
}
