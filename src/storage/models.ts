import { JsonStore } from "./json-store";

export type Thread = { id: string; title?: string; createdAt: string; updatedAt: string };

export type RunRecord = {
  id: string;
  threadId: string;
  prompt: string;
  status: "running" | "completed" | "failed" | "cancelled";
  output?: string;
  createdAt: string;
  updatedAt: string;
};

export type Artifact = {
  id: string;
  runId: string;
  name: string;
  kind: "text" | "json" | "file";
  content?: string;
  path?: string;
  createdAt: string;
};

export type Approval = {
  id: string;
  runId: string;
  tool: string;
  capabilities: string[];
  status: "pending" | "approved" | "denied";
  createdAt: string;
};

export class LocalRepository {
  readonly threads: JsonStore<Thread[]>;
  readonly runs: JsonStore<RunRecord[]>;
  readonly artifacts: JsonStore<Artifact[]>;
  readonly approvals: JsonStore<Approval[]>;

  constructor(dataDir = process.env.LOOP_DATA_DIR ?? ".loop") {
    this.threads = new JsonStore(dataDir + "/threads.json", []);
    this.runs = new JsonStore(dataDir + "/runs.json", []);
    this.artifacts = new JsonStore(dataDir + "/artifacts.json", []);
    this.approvals = new JsonStore(dataDir + "/approvals.json", []);
  }

  async addThread(title?: string) {
    const now = new Date().toISOString();
    const item: Thread = { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now };
    await this.threads.update((items) => [...items, item]);
    return item;
  }

  async addRun(record: RunRecord) {
    await this.runs.update((items) => [...items, record]);
    return record;
  }

  async addArtifact(record: Artifact) {
    await this.artifacts.update((items) => [...items, record]);
    return record;
  }
}
