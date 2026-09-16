export default {
  provider: process.env.LOOP_PROVIDER ?? "mock",
  model: process.env.LOOP_MODEL ?? "mock-echo",
  dataDir: process.env.LOOP_DATA_DIR ?? ".loop",
};
