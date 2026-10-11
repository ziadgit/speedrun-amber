# AGENT.md — how to work in amber (speedhack-agent)

amber is the agent side of the speedhack CV app: CopilotKit runtime + cv-tools
MCP server + React chat page, one Bun process on :4000. Read `IDEA.md` (north
star, seven invariants) and `specs/00-overview.md` first.

**Keep this file short (≤ 150 lines).** Edit in place. Replace stale notes; don't
append duplicates. It is read on every loop, so length costs every loop.

## Stack
- Bun 1.3+ (dev machine: Bun 1.3.11, Node 25) · TypeScript strict · React ·
  `@copilotkit/runtime/v2` · `@copilotkit/react-core/v2` ·
  `@modelcontextprotocol/sdk` · zod. Tests: `bun test`.
- The main app lives in another repo (`sinaatalay/speedhack`). Never edit it;
  contract changes go into `specs/02-cv-tools.md` + `HANDOFF.md`.

## Commands (spec 01 defines them; these are the contract)
- `bun install` — deps
- `bun run dev` — server with hot reload on `PORT` (default 4000; the dev Mac's :4000 is NoMachine, so `.env` sets `PORT=4001`) (`/chat`, `/mcp`, `/api/copilotkit`, `/health`)
- `bun run fake-api` — in-memory AviCV FastAPI stand-in on :8000 (seeded résumé `00000000000000000000000000000001`)
- `bun run darwin-probe` — one live Darwin search (network; never in tests)
- `bun run typecheck` — `tsc --noEmit`
- `bun test` — unit + in-process server tests, no live network
- `bun run build` — bundles the chat page (minified, ~17.6 MB js + 1.5 MB css) to `dist/chat`

Verify order (one subagent): typecheck → test → build.

## Live smoke (manual, needs a model key in `.env`)
`bun run fake-api` and `bun run dev` in two shells, open
`http://localhost:$PORT/chat`, ask "tailor my CV for a backend role at Acme".
Expect `get_profile`, `save_job`, `save_variant`, `log_time_saved` in the
fake-api log. The loop does not run this; it needs a human and a paid key.

Live smoke, CV upload: `bun run fake-api`, open `/chat`, click "Upload your CV to AviCV", expect `POST /resumes` in the fake-api log and `?resume=<id>` in the URL.

## Layout
- `src/config.ts` — `loadConfig(env)`, the only env reader.
- `src/server.ts` — `createServer(config, deps?)`, path-prefix dispatch.
- `src/darwin.ts` — `createDarwinProvider` (`mcpClients` entry, `search` only; union-schema tools break Anthropic). `src/runtime.ts` — `createCopilotHandler(config)`; `src/instructions.ts` — system prompt.
- `src/mcp/` — `tools.ts` (one fn per tool + TOOLS table), `schemas.ts` (zod), `server.ts` (MCP handler).
- `src/chat/` — `avicv-proxy.ts` (`/chat/avicv/*` pass-through to AviCV, injected fetch), `resume.ts` (résumé id from `?resume=`/localStorage, PDF upload via `/chat/avicv/resumes`; pure, tested), `index.html`, `main.tsx`, `messages.ts` (pure, tested), `strip.ts` (header strip formatting/polling, pure, tested), `server.ts` (`createChatHandler`: `Bun.build` on first request with `publicPath: "/chat/"`, assets held in memory, CSP on every response).
- `scripts/` — `fake-api.ts` (AviCV shapes; spec 08), `darwin-probe.ts`. Live network allowed here only.

## Gotchas
- Agent context: `useAgentContext({description, value})` from `@copilotkit/react-core/v2` sends `{avicv_resume_id}` (`ResumeContext` in `main.tsx`). Attachments are off (no `attachments` prop on `CopilotChat`).
- Library APIs in specs are unverified (written from docs, never run). When the
  installed `.d.ts` disagrees, the `.d.ts` wins: follow it and fix the spec in
  the same loop.
- MCP SDK under Bun: prefer a web-standard (Request/Response) Streamable HTTP
  transport if the installed SDK has one; the Node `req/res` transport needs an
  adapter. Used: `WebStandardStreamableHTTPServerTransport` (stateless, `enableJsonResponse`, new McpServer per request) in `src/mcp/server.ts`; tool table `TOOLS` lives in `tools.ts`.
- Tests bind servers to port 0 and read the real port back from `server.port`.
  Always `server.stop(true)` in `afterAll`.
- `BuiltInAgent` takes the system prompt as `prompt`. `GET /api/copilotkit/info` is the no-model health check. `src/server.ts` main builds the copilot handler lazily so `server.port` is known.
- Chat page: `CopilotKitProvider` + `CopilotChat` (`agentId="default"`) from `@copilotkit/react-core/v2`; CSS from `@copilotkit/react-core/v2/styles.css` (typed by `src/chat/css.d.ts`). Bun's HTML bundle emits `./x.js` relative URLs, which break under `/chat` (no trailing slash), hence `publicPath`.
- Change notifications: `useAgent({agentId:"default"}).agent.subscribe({onToolCallStartEvent, onToolCallResultEvent})` feeds `createChangeTracker` (`messages.ts`); the result event carries only the id, so the name is remembered from the start event. Failure = content starting `<tool> failed: `. The exact MCP name prefix the runtime emits is unverified (needs a live run); `resourceForTool` strips `cv_`, `cv__`, `cv.`, `cv/`.
