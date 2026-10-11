# fix_plan — amber (speedhack-agent)

The implementation backlog, derived from `specs/` (hand-written 2026-10-11).
Build loops take the topmost unchecked `P0`. When the P0s are drained, the
topmost `P1`, then `P2`. **Read the named spec before building an item.** The
spec is the authority on behavior. This file only sets the order.

**Effort tags** on each `###` header drive `ralph.sh` auto-effort (the tag is
lowered by `RALPH_EFFORT_REDUCE` notches, default 2, and bumped +1 when an item
doesn't close in a loop). `🧠 xhigh` = load-bearing, unverified library APIs or
invariant-critical. `⚡ high` = mechanical work against an exhaustive spec.

The demo milestone is the end of the **P0** items: the chat page talks to the
agent, which can search Darwin and read/write the app through cv-tools, and the
page tells its parent frame what changed.

## Backlog

### Foundation — ⚡ high
- [x] P0 Scaffold: `package.json` (scripts from spec 01), `tsconfig.json`, deps installed, `.env.example`, `src/config.ts` + tests, `src/server.ts` with `/health` and 404 + test on port 0 (spec 01)
- [x] P0 `scripts/darwin-probe.ts`: write it, run it once live, fill in "Probe result" in spec 05, then unblock or delete the `search_jobs` items below (spec 05)

### cv-tools — 🧠 xhigh
- [x] P0 `src/mcp/schemas.ts` + `src/mcp/tools.ts` with `get_profile` and `save_variant`, fake-fetch tests incl. error paths (spec 02)
- [x] P0 `save_job` and `log_time_saved` (injected clock, fixed baselines) with tests (spec 02)
- [x] P0 `src/mcp/server.ts` MCP handler mounted at `/mcp`; test connects SDK `Client` on port 0 and lists exactly the four tools (spec 02)

### Agent — 🧠 xhigh
- [x] P0 `src/instructions.ts` + `src/runtime.ts` (`createCopilotHandler`), mounted at `/api/copilotkit`; tests: missing `MODEL` error, Darwin rules verbatim, handler answers a no-model request (spec 03)

### Chat page — 🧠 xhigh
- [x] P0 `src/chat/messages.ts` (`resourceForTool`, `changedMessage`) + tests (spec 04)
- [x] P0 Serve `/chat` (React + CopilotKit chat), `/chat/config.json`, CSP `frame-ancestors` on every `/chat*` response; server test; `bun run build` passes (spec 04)
- [x] P0 Post `speedhack:changed` to `appOrigin` once per successful cv-tools call, using the installed react-core API; record the hook used in `AGENT.md` (spec 04)

## Discovered
- [x] P1 `search_jobs` greenhouse descriptions keep HTML entities: greenhouse `content` is HTML escaped once, so after `unescapeHtml` the HTML still holds `&amp;`, `&nbsp;`, `&#39;`, `&mdash;`. Probe: content `&lt;p&gt;R&amp;amp;D&amp;nbsp;team &amp;mdash; it&amp;#39;s great&lt;/p&gt;` returns description `R&amp;D&nbsp;team &mdash; it&#39;s great`, expected `R&D team — it's great`. Fix in `src/mcp/tools.ts`: strip tags first, then decode entities once (named `amp lt gt quot apos nbsp mdash ndash`, numeric `&#NN;` and `&#xHH;`; `&amp;` last so `&amp;lt;` stays `&lt;`). Add the probe as a test named "search_jobs greenhouse decodes entities inside the HTML" in `src/mcp/tools.test.ts` (spec 06 Response shapes)

### Pre-demo hardening 2026-10-11 — ⚡ high
- [x] P0 Minify the chat bundle: `minify: true` in `createChatHandler`'s `Bun.build`, `--minify` in the `build` script; record the new bundle size in `AGENT.md` (spec 04 Serving)
- [x] P1 `/mcp` rejects a `Host` other than `127.0.0.1:<port>`, `localhost:<port>` or `[::1]:<port>` with 403; test with a spoofed Host (spec 01 "`/mcp` also checks the Host header")
- [x] P2 Empty `PORT=` falls back to 4000 like the other variables; add the case to `config.test.ts` (spec 01 Config)

### Live-run fixes 2026-10-11 — 🧠 xhigh
- [x] P0 Expose only Darwin's `search` to the agent via an `mcpClients` provider in `src/darwin.ts`; schema guard test for cv-tools (spec 03 "Darwin tools: `search` only")
- [x] P2 Send `anthropic-workspace-id` when `ANTHROPIC_WORKSPACE_ID` is set: config field, `@ai-sdk/anthropic` direct dep, `agentModel()` in `runtime.ts`, header test with injected fetch, `.env.example` line (spec 03 "Model", spec 01 Config)

### CV upload fixes 2026-10-11 — ⚡ high
- [x] P0 `onUpload` normalizes MIME types to `application/pdf` or `text/plain` and rejects other files with a clear message; tests for `.md` with empty and `text/markdown` types, `.PDF` with empty type, `.png` (spec 07 "MIME types sent to the model")
- [x] P2 `AGENT.md`: note that `PORT` may need to differ from 4000 (on the dev Mac 4000 is NoMachine; `.env` uses 4001) and use `localhost:$PORT` in Live smoke (spec 01 Config)

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
- [ ] P2 Docs: rewrite `HANDOFF.md` for AviCV (`AGENT_URL` in `frontend/src/env.ts`, iframe `${AGENT_URL}/chat?resume=${id}` on `routes/resumes/[id]/+page.svelte`, `avicv:changed` listener refreshing `watchResume`/time savings; no new backend routes needed); update `README.md` tools/config/diagram and `AGENT.md` layout/live smoke; `package.json` name `avicv-agent` (spec 08)
