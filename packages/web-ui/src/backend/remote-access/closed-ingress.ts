import { createHttpServer, listen } from "../http/node-server";

/** Deliberately has no path to the business router or frontend assets. */
export const startClosedIngress = async (port: number) => {
  const server = createHttpServer(
    () =>
      new Response("Remote agent access is not available in this version.\n", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }),
  );
  try {
    const url = await listen(server, port);
    let closing: Promise<void> | undefined;
    return {
      port: Number(url.port),
      close: () =>
        (closing ??= new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        })),
    };
  } catch (error) {
    server.close();
    throw error;
  }
};
