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
