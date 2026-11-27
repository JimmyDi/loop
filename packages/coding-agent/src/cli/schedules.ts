import { readFile } from "node:fs/promises";

const usage = [
  "loop schedules [--port PORT] list | projects",
  "loop schedules [--port PORT] create FILE | edit ID FILE",
  "loop schedules [--port PORT] history|run|cancel|pause|resume|delete ID",
  "Start the local schedule host with loop web --no-open.",
].join("\n");

export const scheduleCommand = async (args: string[]) => {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return 0;
  }
  let port = 3080;
  if (args[0] === "--port") {
    port = Number(args[1]);
    args = args.slice(2);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
  const [action = "list", first, second] = args;
  let path = "/schedules";
  let method = "GET";
  let body: string | undefined;
  if (action === "projects" || action === "list") {
    if (first) throw new Error(usage);
    if (action === "projects") path = "/workspaces";
  } else if (action === "create" || action === "edit") {
    const file = action === "create" ? first : second;
    if (!file || args.length !== (action === "create" ? 2 : 3)) throw new Error(usage);
    body = JSON.stringify(JSON.parse(await readFile(file, "utf8")));
    method = action === "create" ? "POST" : "PUT";
    if (action === "edit") path += "/" + checkedId(first);
  } else {
    if (
      args.length !== 2 ||
      !["history", "run", "cancel", "pause", "resume", "delete"].includes(action)
    )
      throw new Error(usage);
    path += "/" + checkedId(first);
    if (action === "delete") method = "DELETE";
    else if (action === "history") path += "/runs";
    else {
      method = "POST";
      path += "/" + action;
      if (action === "run") body = JSON.stringify({ requestId: crypto.randomUUID() });
    }
  }
  const response = await fetch("http://127.0.0.1:" + port + "/api" + path, {
    method,
    body,
    redirect: "error",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const output = await response.text();
  if (!response.ok) throw new Error(output || response.statusText);
  if (output) console.log(JSON.stringify(JSON.parse(output), null, 2));
  return 0;
};

const checkedId = (id?: string) => {
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid schedule ID");
  return id;
};
