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
- [ ] P0 Scaffold: `package.json` (scripts from spec 01), `tsconfig.json`, deps installed, `.env.example`, `src/config.ts` + tests, `src/server.ts` with `/health` and 404 + test on port 0 (spec 01)
- [ ] P0 `scripts/darwin-probe.ts`: write it, run it once live, fill in "Probe result" in spec 05, then unblock or delete the `search_jobs` items below (spec 05)

### cv-tools — 🧠 xhigh
- [ ] P0 `src/mcp/schemas.ts` + `src/mcp/tools.ts` with `get_profile` and `save_variant`, fake-fetch tests incl. error paths (spec 02)
- [ ] P0 `save_job` and `log_time_saved` (injected clock, fixed baselines) with tests (spec 02)
- [ ] P0 `src/mcp/server.ts` MCP handler mounted at `/mcp`; test connects SDK `Client` on port 0 and lists exactly the four tools (spec 02)

### Dev API — ⚡ high
- [ ] P0 `scripts/fake-api.ts` with `createFakeApi(port)` + tests; round-trip test: SDK `Client` → `/mcp` → fake API, `save_job` then `save_variant` (spec 05, spec 02)

### Agent — 🧠 xhigh
- [ ] P0 `src/instructions.ts` + `src/runtime.ts` (`createCopilotHandler`), mounted at `/api/copilotkit`; tests: missing `MODEL` error, Darwin rules verbatim, handler answers a no-model request (spec 03)

### Chat page — 🧠 xhigh
- [ ] P0 `src/chat/messages.ts` (`resourceForTool`, `changedMessage`) + tests (spec 04)
- [ ] P0 Serve `/chat` (React + CopilotKit chat), `/chat/config.json`, CSP `frame-ancestors` on every `/chat*` response; server test; `bun run build` passes (spec 04)
- [ ] P0 Post `speedhack:changed` to `appOrigin` once per successful cv-tools call, using the installed react-core API; record the hook used in `AGENT.md` (spec 04)

### Job boards fallback — ⚡ high
- [ ] P1 Boards probe: fetch one live board per provider, correct the URL/shape table in spec 06 (spec 06) blocked-by: darwin-probe result
- [ ] P1 `search_jobs` tool with fixture-based tests, registered in cv-tools; add the instructions line (spec 06) blocked-by: boards probe

## Discovered
