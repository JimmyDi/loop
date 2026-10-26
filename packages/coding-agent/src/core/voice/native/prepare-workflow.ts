import { appendFile } from "node:fs/promises";
import { voiceWorkflowMatrix } from "./workflow-matrix";

if (process.argv.length > 2)
  throw new Error("prepare-workflow.ts reads VOICE_RELEASE_TARGETS only");
if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
const { matrix, targets } = voiceWorkflowMatrix(process.env.VOICE_RELEASE_TARGETS);
await appendFile(
  process.env.GITHUB_OUTPUT,
  "matrix=" + JSON.stringify(matrix) + "\ntargets=" + targets + "\n",
);
