import { McpConfigError } from "@loop/coding-agent";
import type { McpManager } from "@loop/coding-agent";

import { HttpError } from "../http/errors";
import { readBody } from "../http/input";

export const mcpRoutes =
  (manager: McpManager) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    const match = /^\/api\/settings\/mcp(?:\/([a-zA-Z0-9_-]+))?(?:\/(retry|enabled))?$/.exec(
      url.pathname,
    );
    if (!match) return;
    const [, id, action] = match;
    if (action && !id) throw new HttpError(404, "not_found");
    try {
      if (request.method === "GET" && !id && !action)
        return Response.json({ servers: await manager.list() });
      if (request.method === "POST" && action === "retry" && id) manager.retry(id);
      else if (request.method === "PATCH" && action === "enabled" && id) {
        const body = await readBody(request);
        if (typeof body.enabled !== "boolean" || Object.keys(body).some((key) => key !== "enabled"))
          throw new HttpError(400, "invalid_mcp_config");
        await manager.setEnabled(id, body.enabled);
      } else if (
        (request.method === "POST" && !id) ||
        (request.method === "PUT" && id && !action)
      ) {
        const body = await readBody(request);
        if (id && body.id !== id) throw new HttpError(400, "invalid_mcp_config");
        await manager.save(body, !id);
      } else if (request.method === "DELETE" && id && !action) await manager.remove(id);
      else throw new HttpError(405, "method_not_allowed");
      return Response.json({ servers: await manager.list() });
    } catch (error) {
      if (error instanceof McpConfigError)
        throw new HttpError(
          error.code === "mcp_exists"
            ? 409
            : error.code === "mcp_not_found"
              ? 404
              : error.code.startsWith("mcp_config_")
                ? 500
                : 400,
          error.code,
        );
      throw error;
    }
  };
