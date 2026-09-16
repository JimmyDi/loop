import { createServer } from "./api";

const server = createServer();

console.log(`Loop API listening on http://127.0.0.1:${server.port}`);
