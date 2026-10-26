# Local Voice Transport

Loop's Web voice layer connects authenticated browser audio to the public coding-agent voice runtime. Agent sessions continue to receive ordinary text prompts and retain their existing tools, permissions, approvals and queue scheduling.

## Setup

Install compatible resources from **Settings → Voice** on the computer running Loop. Installation is explicit and local-only. The settings response reports supported platform, individual engine/ASR/VAD/TTS components, download progress, installed bytes, versions and errors. Resource downloads must exist in the reviewed Loop release catalog before installation is available; no resource is downloaded at startup.

The managed files live under the coding-agent data directory's `voice/` folder. Changing `LOOP_DATA_DIR` changes that data root. Microphone audio, temporary recognition state and generated speech remain in memory. Submitted final text uses the existing session storage.

## HTTP Contracts

| Endpoint | Contract |
| --- | --- |
| `GET /api/voice/status` | Installation/resource status; remote devices cannot see the absolute resource directory. |
| `POST /api/voice/install` | Local-only `{action, profile}`, with install/update/cancel/uninstall and input/conversation profiles. Installation runs asynchronously; poll status. |
| `POST /api/voice/calls` | `{clientId, mode, sessionId?}` creates one call and returns `{callId, ticket, expiresAt}`. Mode is dictation, conversation or settings test. |
| `POST /api/voice/calls/:id/connect` | The original owner/client requests a fresh single-use connection ticket. |
| `POST /api/voice/calls/:id/close` | The original owner/client ends audio processing, independently of the Agent task. |

Local commands require the exact request Origin; remote commands retain paired-device cookies and CSRF protection. Call tickets expire after thirty seconds, are delivered only in a protected response and are never placed in a URL. A server process permits one active call.

## WebSocket Protocol

Connect to `/api/voice/calls/:id/socket` on the same origin, then send an authenticate JSON frame containing the ticket. The handshake checks local Host/Origin or paired remote-device authorization. Production, remote ingress and the authenticated development gateway all support the same protocol.

- Browser binary frames contain mono 16 kHz PCM16LE, at most 32 KiB per message. Server input buffering is limited to about two seconds; overflow terminates the audio connection rather than dropping and splicing samples.
- JSON controls configure microphone/reading state, finish the current utterance, interrupt a playback generation, request short speech, or close the call. Control and audio processing remain separately cancellable.
- The server emits ready, transcript, status and error JSON frames. Each utterance carries a stable ID; partials are replaced until one final.
- Each audio JSON frame describes a playback generation, sample rate and WAV format; the next binary frame contains that WAV chunk. Generated audio is not served through session file downloads or written to disk.
- The browser stops playback immediately on local speech detection. Generation checks discard late synthesis, download and decode results.

Final text is submitted through the existing session prompt endpoint. Its optional boolean `steering` is part of the deduplication signature and reaches core enqueue atomically. Ordinary speech while busy adds follow-ups; steering takes effect at the next model boundary after the current response and complete tool batch. Stopped sessions remain paused until explicit Resume.

## Recovery and Authorization

An ordinary transport disconnect cancels speech, discards the incomplete utterance and starts a thirty-second call lease. Reconnection needs a fresh ticket and does not replay microphone audio or old TTS. Device expiry, durable revocation, explicit hangup and server shutdown immediately dispose of the call. Device invalidation reaches a development worker over private IPC even while the call is disconnected.

Authorization is checked before and after asynchronous session/resource startup. Expiry, revocation and cancellation of the opening HTTP request stop an opening native runtime before a ticket can be published. Cancelling that request after its response does not end an established call. The development supervisor includes prior invalidations in the worker's initial handshake and waits for a per-request revocation acknowledgement after native cleanup. Worker exit also settles that wait; an unresponsive worker is terminated. WebSocket heartbeat pings cross the development proxy and require the browser's pong rather than an automatic proxy response.

The browser pauses automatic submission if either voice transport or the main session stream is unavailable. It uses the existing request identity and stream checks for uncertain text delivery. A backend restart expires voice calls and in-memory queues; completed session history remains authoritative.

Phone use requires a secure context, microphone permission and a foreground page. Remote audio is inferred on the computer but passes through the configured tunnel relay; local inference does not imply relay-blind encryption. See [remote devices](remote-devices.md) and [PWA limits](../../frontend/docs/pwa.md).

## Source and Validation

- [Voice service](../voice/voice-service.ts) and [integration tests](../voice/voice-service.test.ts).
- [Call contracts](../voice/call-types.ts), [connection tickets](../voice/voice-tickets.ts) and [ticket tests](../voice/voice-tickets.test.ts).
- [HTTP routes](../voice/voice-routes.ts) and [tests](../voice/voice-routes.test.ts).
- [WebSocket upgrade](../http/voice-upgrade.ts), [remote handshake](../remote-access/remote-voice.ts) and their colocated tests.
- [Upgrade contracts](../http/voice-upgrade-types.ts) and [development transport](../startup/voice-proxy.ts).
- [Core voice runtime](../../../../coding-agent/src/docs/voice.md), [frontend interaction](../../frontend/docs/voice.md).
