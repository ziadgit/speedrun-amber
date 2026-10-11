# DONE — completed fix_plan sections, oldest first

### Dev API — ⚡ high
- [x] P0 `scripts/fake-api.ts` with `createFakeApi(port)` + tests; round-trip test: SDK `Client` → `/mcp` → fake API, `save_job` then `save_variant` (spec 05, spec 02)

### Job boards fallback — ⚡ high
- [x] P1 Boards probe: fetch one live board per provider, correct the URL/shape table in spec 06 (spec 06)
- [x] P1 `search_jobs` tool with fixture-based tests, registered in cv-tools; add the instructions line (spec 06) blocked-by: boards probe

### Review fixes 2026-10-11 — 🧠 xhigh
- [x] P0 `log_time_saved` timing: task start resets after each `log_time_saved` instead of being server-lifetime; tests for the two scenarios in spec 02 (spec 02 "Task start")
- [x] P0 Change tracker treats a result as failed when its JSON envelope has `isError: true`; replace bare-string tests with the real envelope (spec 04 "Success test")
- [x] P1 `/mcp` rejects non-loopback clients with 403 via `server.requestIP`, injectable `clientIp` for tests (spec 01 "`/mcp` is loopback-only")
- [x] P2 `.env.example` gains `COPILOTKIT_TELEMETRY_DISABLED=true`; missing-`MODEL` error example uses `anthropic:` form (spec 01 Config)

### Audit 2026-10-11 — ⚡ high
- [x] P1 `parseOrigin` rejects valid origins: `loadConfig({APP_ORIGIN:"https://example.com:443"})`, `"http://localhost:80"` and `"HTTP://Localhost:5173"` all throw "must be a bare origin (no path)" because it compares `url.origin` to the raw string (default ports and case are normalized away). Judge "bare" by the parsed URL instead (pathname `/`, no search, hash or credentials) and return `url.origin`. Add the three cases to `src/config.test.ts` (each expects the normalized origin); `"http://x/path"`, `"*"` still throw (spec 01 Config)

### CV upload 2026-10-11 — 🧠 xhigh
- [x] P0 `save_profile` tool (`PUT /profile`), `get_profile` 404 → "no profile yet" error, fake API `PUT /profile` + empty-profile option, tests incl. the empty → save → get round trip (spec 07, spec 02, spec 05)
- [x] P0 Instructions: the three CV-upload lines verbatim + test (spec 07 Instructions)
- [x] P0 Chat attachments: `src/chat/attachments.ts` config (PDF/TXT/MD, 5 MB, inline error), passed to `CopilotChat`; `resourceForTool("save_profile")` → `"profile"`; tests; Live smoke step in `AGENT.md` (spec 07 Chat page)
- [x] P2 DOCX: convert in the browser with `mammoth` in `onUpload`, fixture test (spec 07 P2)
