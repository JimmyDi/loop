#!/usr/bin/env bash
set -euo pipefail

# CLI consumer: run the executable with arguments, without importing SDK modules.
# Interactive: bash src/coding-agent/cli.sample.sh
# Print:       bash src/coding-agent/cli.sample.sh --print "Read package.json"
# Resume:      bash src/coding-agent/cli.sample.sh --continue
# Custom URL:  bash src/coding-agent/cli.sample.sh --base-url https://gateway.example.com/v1
# Configure LOOP_AI_API_KEY (gateway) or OPENAI_API_KEY (direct OpenAI) in the environment.
# LOOP_AI_BASE_URL also sets the gateway URL. Existing .env configuration is loaded by Bun.

: <<'AGENT_MAESTRO_SAMPLE'
Agent Maestro (copy the command below and run from the project root):

bun run coding-agent \
  --provider openai \
  --model gpt-5.5 \
  --base-url http://127.0.0.1:23333/api/openai/v1 \
  --api-key "local-placeholder"
AGENT_MAESTRO_SAMPLE

sample_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# The CLI defaults to OpenAI GPT-5.5; --provider/--model or environment override it.
# Keep the caller's working directory so tools operate on the intended project.
exec bun "$sample_dir/cli.ts" "$@"
