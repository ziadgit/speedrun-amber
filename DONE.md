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

### AviCV integration 2026-10-11 — 🧠 xhigh
- [x] P0 Rewrite `scripts/fake-api.ts` + its test to AviCV's routes and shapes: seeded résumé, fixture jobs, upload with status steps, tailoring steps, 404 `detail` for unknown job_key; drop `FAKE_API_EMPTY_PROFILE` (spec 08 "Fake API"; check shapes against `~/ralphapps/avicv/backend/src/backend`)
- [x] P0 Replace cv-tools with the eight AviCV tools in `src/mcp/schemas.ts` + `tools.ts` (resume_id check, trimmed outputs, `APP_ORIGIN` download/page URLs, https-only job urls, `detail` in errors); delete the old five tools, board fetch, `boards-probe`, and their tests; MCP test lists exactly eight (spec 08 "cv-tools")
- [x] P0 In-process round trip against the fake API on port 0: upload → get_resume → list_matches → tailor_cv → get_tailored_cv → get_time_savings (spec 08 Acceptance)
- [x] P0 `src/instructions.ts`: the AviCV rules verbatim plus Darwin rules, Darwin marked secondary; drop the CV-upload rules; update the verbatim test (spec 08 "Instructions")
- [x] P0 `/chat/avicv/*` proxy routes (upload, stats, résumé, time-savings) with id validation, allowlist, CSP, no-store; tests (spec 08 "Proxy routes")
- [x] P0 Chat page résumé id: `?resume=` param, localStorage fallback, "Upload your CV to AviCV" button, agent context `avicv_resume_id` via the installed v2 hook (record it in `AGENT.md`); remove attachments, `attachments.ts`, mammoth and their tests (spec 08 "Chat page")
- [x] P1 AviCV header strip: wordmark → `APP_ORIGIN`, catalog size, résumé chip → `page_url` with status/progress, time saved; polling rules; pure formatting helpers tested (spec 08 "AviCV header strip")
- [x] P1 Tool-result cards: match cards with score %, Apply link, "Tailor my CV" button; tailored-CV card with Download PDF; use the installed v2 tool-call renderer (spec 08 "Tool results render as cards")
- [x] P1 `avicv:changed` rename and new `resourceForTool` mapping; tests (spec 08 "Change notifications")
- [x] P2 Empty-state suggestions and AviCV copy everywhere visible; page title "AviCV agent" (spec 08 Chat page)
- [x] P2 Docs: rewrite `HANDOFF.md` for AviCV (`AGENT_URL` in `frontend/src/env.ts`, iframe `${AGENT_URL}/chat?resume=${id}` on `routes/resumes/[id]/+page.svelte`, `avicv:changed` listener refreshing `watchResume`/time savings; no new backend routes needed); update `README.md` tools/config/diagram and `AGENT.md` layout/live smoke; `package.json` name `avicv-agent` (spec 08)
- [x] P1 `search_jobs` results render job cards with a "Tailor my CV" button, but a catalog `id` is not a match `job_key`, so the message it sends makes `tailor_cv` fail with AviCV's 404 (spec 08: job_key must come from `list_matches`; cards are specified for `list_matches` only). Probe: `jobCards({jobs:[{id:"greenhouse:acme:123",title:"Backend Engineer",company:"Acme"}]})` gives `jobKey:"greenhouse:acme:123"` and `tailorMessage` gives "Tailor my CV for Backend Engineer at Acme (job_key greenhouse:acme:123)". Fix in `src/chat/cards.ts` + `main.tsx`: only `list_matches` (`items`) yields cards with the Tailor button; `search_jobs` shows no card (or Apply-only, no button). Replace the "maps search_jobs jobs" case in `src/chat/cards.test.ts` with one named "jobCards ignores search_jobs rows" (spec 08 "Tool results render as cards")
