import { AgentRuntime } from "../core/runtime";
import { createProvider } from "../providers";
import { LocalRepository } from "../storage/models";

export type ApiContext = { runtime?: AgentRuntime; repository?: LocalRepository };

export const createApi = (context: ApiContext = {}) => {
  const runtime = context.runtime ?? new AgentRuntime();
  const repository = context.repository ?? new LocalRepository();
  return {
    async run(body: { prompt: string; provider?: string; model?: string }) {
      if (!body.prompt?.trim()) throw new Error("prompt is required");
      return runtime.run(body.prompt, {
        provider: createProvider(body.provider),
        model: body.model ?? process.env.LOOP_MODEL ?? "mock-echo",
      });
    },
    async history() {
      return {
        threads: await repository.threads.read(),
        runs: await repository.runs.read(),
        artifacts: await repository.artifacts.read(),
      };
    },
  };
};

export const createServer = (context: ApiContext = {}) => {
  const api = createApi(context);
  return Bun.serve({
    port: Number(process.env.LOOP_PORT ?? 3210),
    routes: {
      "/api/health": new Response(JSON.stringify({ ok: true })),
      "/api/history": { GET: async () => Response.json(await api.history()) },
      "/api/run": {
        POST: async (request) => {
          try {
            return Response.json(await api.run(await request.json()));
          } catch (error) {
            return Response.json({ error: String(error) }, { status: 400 });
          }
        },
      },
    },
  });
};
