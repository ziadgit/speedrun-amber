# amber (speedhack-agent): a chat agent for the speedhack CV app

## North star
The speedhack CV app (SvelteKit + FastAPI, repo `sinaatalay/speedhack`) gets a
chat agent. The user opens the app's chat page and says "find me backend roles
at fintechs and tailor my CV for the best one". The agent searches Darwin for
outside agents that can supply job postings, saves a job, reads the master
profile, saves a tailored CV variant and logs the time it saved the user. The
app's page refreshes as each thing lands.

This repo is the agent side only: one Bun process on port 4000 serving
`/api/copilotkit` (the agent), `/mcp` (cv-tools) and `/chat` (the React chat
page the app embeds in an iframe). The design is `specs/00-overview.md`; the
numbered specs refine it and win on conflict.

End state for tonight: `bun run dev` with `bun run fake-api` (or the real
FastAPI) running, open `http://localhost:4000/chat`, ask for a tailored CV, and
watch the agent call Darwin `search`, then `get_profile`, `save_job`,
`save_variant` and `log_time_saved`, with each call landing in the API.

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
- **Main repo is not ours.** This loop never edits `sinaatalay/speedhack`. What
  it must add lives in `HANDOFF.md` for a human.
- **Out of scope:** Darwin `act`/`get_thread`/`pay`, Darwin OAuth, Darwin
  Publish, Dial, auth, persistence beyond the main repo's API, deployment.

## The seven invariants (LAW)
1. **App data only through FastAPI.** cv-tools reads and writes app data only
   by HTTP calls to `API_URL`. No database, file or in-process store of app data
   in `src/`. (`scripts/fake-api.ts` is a dev stand-in, never imported by `src/`.)
   The single allowed exception is `search_jobs` (spec 06), if it ships.
2. **The contract is exact.** Tool names, inputs and outputs, and the REST
   routes and bodies behind them, match `specs/02-cv-tools.md` exactly. A change
   to the contract is a spec change first, plus a `HANDOFF.md` update.
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
