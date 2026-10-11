# 04 · The chat page at `/chat`

A small React page using `@copilotkit/react-core/v2`: the CopilotKit provider
pointed at `/api/copilotkit` (same origin) and CopilotKit's stock chat
component filling the viewport. Plain, readable styling; no design system.

## Serving
- `GET /chat` serves `src/chat/index.html`, bundled by Bun (HTML import in
  `Bun.serve` routes, or a `Bun.build` at startup, whichever lets us set
  headers). Its assets are served under `/chat/`.
- The bundle is minified (`minify: true` on `Bun.build`; the unminified page was
  ~24 MB, too slow over a tunnel). Sourcemaps off. `bun run build` uses
  `--minify` too so it checks the same output.
- Every `/chat*` response carries
  `Content-Security-Policy: frame-ancestors <APP_ORIGIN>` (invariant 6). Not
  `X-Frame-Options` (it cannot name an origin).
- `GET /chat/config.json` → `{ "appOrigin": APP_ORIGIN }`. The page fetches it
  at startup; nothing is baked in at build time.

## Telling the app what changed
When a cv-tools call finishes successfully in the chat, the page posts:
```ts
window.parent.postMessage({ type: "speedhack:changed", resource }, appOrigin);
```
`src/chat/messages.ts` is pure and unit-tested:
- `resourceForTool(name)`: `save_job` → `"jobs"`, `save_variant` →
  `"variants"`, `log_time_saved` → `"time-saved"`, anything else → `null`.
  Accepts MCP-prefixed names too: strip one leading `cv_`, `cv__`, `cv.` or
  `cv/` before the lookup (record the prefix the runtime really uses in `AGENT.md`).
- `changedMessage(resource)` builds the object above.
- Post only when `window.parent !== window` and once per tool-call id.
- **Success test.** Verified in the installed runtime (`@copilotkit/runtime`
  `dist/agent/index.mjs`, TOOL_CALL_RESULT): the result event's `content` is
  `JSON.stringify(<MCP CallToolResult>)`, e.g.
  `{"content":[{"type":"text","text":"save_job failed: 500 …"}],"isError":true}`.
  A call failed when that JSON parses to an object with `isError: true`, or (when
  content is not JSON) when the text starts with `<tool> failed: `. Anything else
  is success. Tests must use this real envelope, not bare strings.
- Tool names reach the page unprefixed (`save_job`); the runtime prefixes an MCP
  tool with `cv_` only when another source has a tool of the same name. Keep the
  prefix stripping as a fallback.

How the page learns a tool call finished depends on the installed
`@copilotkit/react-core/v2` API (a tool-call render hook, an agent event
subscription, or message state). Read its `.d.ts`, pick the one that sees MCP
tool results, and record the choice in `AGENT.md`.

## Acceptance
- Unit tests for `messages.ts`.
- Server test: `/chat` returns HTML with the CSP header naming `APP_ORIGIN`;
  `/chat/config.json` returns the origin.
- `bun run build` bundles the page with no errors.
