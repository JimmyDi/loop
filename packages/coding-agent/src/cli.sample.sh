#!/usr/bin/env bash
set -euo pipefail

# CLI consumer: run the executable with arguments, without importing SDK modules.
# Interactive: bash packages/coding-agent/src/cli.sample.sh
# Print:       bash packages/coding-agent/src/cli.sample.sh --print "Read package.json"
# Resume:      bash packages/coding-agent/src/cli.sample.sh --continue
# Custom URL:  bash packages/coding-agent/src/cli.sample.sh --base-url https://gateway.example.com/v1
# Configure LOOP_AI_API_KEY (gateway) or OPENAI_API_KEY (direct OpenAI) in the environment.
# LOOP_AI_BASE_URL also sets the gateway URL. Existing .env configuration is loaded by the application entry.

: <<'EXAMPLE_GATEWAY_SAMPLE'
Example gateway (replace the URL, model ID, and API key before running):

pnpm coding-agent \
  --provider openai \
  --model example-model \
  --base-url https://gateway.example.com/v1 \
  --api-key "your-api-key-here"
EXAMPLE_GATEWAY_SAMPLE

sample_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# The CLI defaults to OpenAI GPT-5.5; --provider/--model or environment override it.
# Run pnpm build first. Preserve the caller's working directory for project tools.
exec node "$sample_dir/../../../dist/bin.js" "$@"
