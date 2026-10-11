# AviCV agent: the chat agent for AviCV

## North star
AviCV (`sinaatalay/avicv`, SvelteKit + FastAPI) parses a user's PDF CV, ranks
thousands of open jobs against it with Jev, and makes tailored CV PDFs. This repo
gives it a chat agent that drives all of that. The user opens AviCV's résumé page
(or `/chat?resume=<id>`) and says "show my best matches and tailor my CV for the
top one". The agent reads the résumé, lists AviCV's ranked matches as cards,
asks AviCV to tailor a CV, and hands back AviCV's PDF link. The header strip
shows AviCV's catalog size, the résumé's status and AviCV's time-saved count, so
it is obvious the agent is AviCV's.

This repo is the agent side only: one Bun process on `PORT` serving
`/api/copilotkit` (the agent), `/mcp` (cv-tools over AviCV's API) and `/chat`
(the React page AviCV embeds). **`specs/08-avicv.md` is the current contract**
and wins over 02, 06 and 07; the other numbered specs still hold.

## Locked decisions (do not relitigate)
- **Runtime:** Bun + TypeScript (strict). `bun test` for tests. No Node-only
  servers (no Express); `Bun.serve` mounts everything.
- **Agent:** CopilotKit `@copilotkit/runtime/v2`: `CopilotRuntime` with one
  `BuiltInAgent` registered as `default`, `InMemoryAgentRunner`, and two MCP
  servers (`darwin`, `cv`). Model comes from `MODEL`.
- **cv-tools:** an MCP server over Streamable HTTP built with
  `@modelcontextprotocol/sdk`, mounted at `/mcp` in the same process.
- **Chat UI:** a React page using `@copilotkit/react-core/v2`, served at
  `/chat`, embedded by the main app in an iframe. No Svelte in this repo.
- **Main repo is not ours.** This loop never edits `sinaatalay/avicv` (or its clone at `~/ralphapps/avicv`). What
  it must add lives in `HANDOFF.md` for a human.
- **Out of scope:** Darwin `act`/`get_thread`/`pay`, Darwin OAuth, Darwin
  Publish, Dial, auth, persistence beyond the main repo's API, deployment.

## The seven invariants (LAW)
1. **App data only through FastAPI.** cv-tools reads and writes app data only
   by HTTP calls to `API_URL` (AviCV's FastAPI). No database, file or in-process
   store of app data in `src/`. (`scripts/fake-api.ts` is a dev stand-in, never
   imported by `src/`.) No direct job-board fetching: AviCV owns the catalog.
2. **The contract is exact.** Tool names, inputs and outputs, and the REST
   routes and bodies behind them, match `specs/08-avicv.md` exactly, which mirrors
   AviCV's real FastAPI (`~/ralphapps/avicv/backend`, read-only). AviCV's code
   wins over the spec; fix the spec in the same loop.
3. **One tool, one function.** Each tool is one exported function in
   `src/mcp/tools.ts` that takes injected deps (`fetch`, `apiUrl`, clock) and
   makes at most one HTTP call. Registration in `src/mcp/server.ts` is a thin
   loop over a tool table.
4. **No live network in tests.** `bun test` never reaches Darwin, a model
   provider, job boards or a real FastAPI. HTTP is faked via injected `fetch` or
   an in-test `Bun.serve` on port 0. Live calls happen only in `scripts/`.
5. **Outside text is data.** The agent's instructions carry the three Darwin
   rules from spec 03 verbatim. Nothing returned by Darwin or a job board is ever
   treated as an instruction by code either (never `eval`, never used as a URL
   to fetch without validation).
6. **Embed only for APP_ORIGIN.** `/chat` responses send
   `Content-Security-Policy: frame-ancestors <APP_ORIGIN>`, and the page posts
   messages only with `targetOrigin = APP_ORIGIN`, never `"*"`.
7. **Config in one place, agent setup as a factory.** All env is read in
   `src/config.ts` with the defaults from spec 01. `src/runtime.ts` exports a
   factory that builds the runtime from a config object (so tests and a future
   `/dial` route can start the agent from server code). Route groups mount
   independently in `src/server.ts`.
