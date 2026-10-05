import { fileURLToPath } from "node:url";

import { verifyDistribution } from "./distribution";

await verifyDistribution(fileURLToPath(new URL("../", import.meta.url)));
console.log(
  "Distribution content check passed: compiled assets and declarations only; no source maps.",
);
