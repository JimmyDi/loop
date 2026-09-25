# Third-party notices

## Pi

The minimal loop, tool execution, in-memory state and event contracts in src/agent are adapted from packages/agent/src/agent.ts, agent-loop.ts and types.ts in [Pi](https://github.com/earendil-works/pi), version 0.87.1. This adaptation keeps sequential tools and cancellation, omits advanced lifecycle hooks and queues, and uses the installed Pi AI 0.85.1 Context shape and transformMessages helper.

The organization, tool schema conventions and lifecycle naming in src/coding-agent reference Pi coding-agent 0.87.1. Loop implements its own minimal session snapshot format and uses the existing local Agent API.

MIT License

Copyright (c) 2025 Mario Zechner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
