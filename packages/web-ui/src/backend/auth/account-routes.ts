import { HttpError } from "../http/errors";
import { readBody, requiredString } from "../http/input";
import type { Accounts } from "./accounts";
import { loginCookie } from "./login-store";

export const accountRoutes =
  (accounts: Accounts) =>
  async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    if (path === "/api/auth/session" && request.method === "GET") {
      let user = null;
      try {
        user = accounts.authenticate(request).user;
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401) throw error;
      }
      return Response.json({ user });
    }
    if (request.method === "POST" && ["/api/auth/login", "/api/auth/register"].includes(path)) {
      const body = await readBody(request, 4096);
      const password = requiredString(body, "password");
      if (password.length > 1024) throw new HttpError(400, "invalid_password");
      const result = await accounts.login(
        requiredString(body, "username"),
        password,
        path.endsWith("/register"),
      );
      return Response.json(
        { user: result.user },
        { headers: { "Set-Cookie": loginCookie(request, result.token) } },
      );
    }
    accounts.authenticate(request);
    if (path === "/api/auth/logout" && request.method === "POST") {
      await accounts.logout(request);
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": loginCookie(request, "") },
      });
    }
    if (path === "/api/auth/password" && request.method === "POST") {
      const body = await readBody(request, 8192);
      if (Object.keys(body).some((key) => !["currentPassword", "password"].includes(key)))
        throw new HttpError(400, "invalid_account_change");
      await accounts.changePassword(
        request,
        requiredString(body, "currentPassword"),
        body.password,
      );
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": loginCookie(request, "") },
      });
    }
    throw new HttpError(404, "not_found");
  };
