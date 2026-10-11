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
- [ ] P1 `jobCards` drops list_matches rows whose `company` is null (AviCV's `Match.company` is `str | None`; `jobs/normalize.py` stores `None` for a blank company), so a ranked match silently has no card and no Tailor button. Probe: `jobCards({items:[{job_key:"k1",title:"Backend Engineer",company:null,score:0.9},{job_key:"k2",title:"SRE",company:"Acme",score:0.8}]})` returns only `k2`; expected both. Fix in `src/chat/cards.ts`: require only `job_key` and `title`, make `JobCard.company` `string | null`, render without " · company" and send `tailorMessage` as "Tailor my CV for <title> (job_key <key>)" when null. Add a test named "jobCards keeps matches without a company" in `src/chat/cards.test.ts` (spec 08 "Tool results render as cards")
