# HTTP Boundaries

The Web API serves a local single-user interface. Browser and API share an origin. Routes validate request origin and input before calling the SDK. Feature endpoints are documented under [projects](projects.md), [sessions](sessions.md), [providers](providers.md), and [SSE](events.md).

## Local Request Validation

The request URL host must be localhost, 127.0.0.1, or `[::1]`. If a Host header is present, it must match the URL host. A supplied Origin must exactly match the current origin, and Sec-Fetch-Site: cross-site is rejected. Failures return invalid_host or invalid_origin (403).

The service listens only on 127.0.0.1. These checks are neither login authentication nor a tool sandbox; local programs can still access the service. There is no cross-origin CORS access, public hosting, or multi-user isolation.

## JSON Input

Write endpoints using readBody require Content-Type starting with application/json and a streamed request body no larger than 1 MiB. JSON must be a non-null object. Arrays and invalid JSON return invalid_body (400); oversized input returns body_too_large (413), and an incorrect media type returns json_required (415).

requiredString checks for nonempty text while preserving the original string, including prompt whitespace. Model configuration has additional field-length and URL validation. Session routes resolve IDs through the registry instead of accepting arbitrary session file paths.

## Error Responses

Errors use this shape. The frontend translates code and displays message for unknown errors:

```json
{
  "code": "session_busy",
  "message": "session_busy"
}
```

| Condition | Status and code |
| --- | --- |
| Invalid input | 400 with the relevant field/configuration code |
| Missing project or session | 404, project_not_found / session_not_found |
| Busy session or pending save | 409, session_busy / pending_save |
| Project removal or provider configuration conflict | 409, project_busy / provider_busy |
| Same request ID with different text | 409, request_conflict |
| Server shutdown | 503, server_closing |
| Unexpected exception | 500, operation_failed; message retains the exception description |

Unmatched routes return 404 with not_found. Some matched features return 405 for unsupported methods; do not assume every path handles invalid methods identically.

Normal routed responses set Cache-Control: no-store; errorResponse constructs exception responses separately. Error details can include SDK or filesystem information for local display, not a public log or telemetry interface. Provider configuration endpoints return only redacted views.

## Source and Tests

- [router](../router.ts) / [tests](../router.test.ts).
- [local-request](../http/local-request.ts) / [origin validation tests](../http/local-request.test.ts).
- [input](../http/input.ts) / [input-limit tests](../http/input.test.ts).
- [errors](../http/errors.ts) / [error contract tests](../http/errors.test.ts).
