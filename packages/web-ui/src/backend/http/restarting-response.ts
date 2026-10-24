export const restartingResponse = (request: Request): Response => {
  const headers = { "Cache-Control": "no-store", "Retry-After": "2" };
  if (new URL(request.url).pathname.startsWith("/api/"))
    return Response.json({ code: "backend_restarting" }, { status: 503, headers });
  return new Response(
    request.method === "HEAD"
      ? null
      : `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="2"><title>Loop</title><style>:root{color-scheme:light dark}body{font:16px system-ui;text-align:center;padding:20vh 24px}</style></head><body><h1>Loop is restarting · Loop 正在重启</h1><p>This page retries automatically. 页面将自动重试。</p><a href="/">Retry · 重试</a></body></html>`,
    { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } },
  );
};
