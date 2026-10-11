# 01 · Scaffold, config, commands

## Layout
```
src/
  config.ts          loadConfig(env = process.env): Config   (invariant 7)
  server.ts          createServer(config, deps?) → Bun.serve; main entry when run directly
  runtime.ts         createCopilotHandler(config) → fetch handler for /api/copilotkit
  instructions.ts    AGENT_INSTRUCTIONS string (spec 03)
  mcp/
    server.ts        createMcpHandler(config, deps?) → fetch handler for /mcp
    tools.ts         one exported function per tool + the TOOLS table (spec 02)
    schemas.ts       zod schemas for tool inputs and API responses
  chat/
    index.html
    main.tsx         CopilotKit provider + chat component (spec 04)
    messages.ts      pure: tool name → resource, message builder (unit-tested)
scripts/
  fake-api.ts        in-memory stand-in for the four FastAPI routes (spec 05)
  darwin-probe.ts    one live Darwin search (spec 05)
```
Tests sit beside code: `foo.ts` → `foo.test.ts`.

## Dependencies
Runtime: `@copilotkit/runtime`, `@copilotkit/react-core`, `react`, `react-dom`,
`@modelcontextprotocol/sdk`, `zod`. Dev: `typescript`, `@types/bun`,
`@types/react`, `@types/react-dom`. Add a model-provider package only if the
installed `BuiltInAgent` types require one for the `MODEL` string; record which
in `AGENT.md`. Install latest; pin nothing by hand.

## package.json scripts (the contract)
| Script | Command |
| --- | --- |
| `dev` | `bun --hot src/server.ts` |
| `start` | `bun src/server.ts` |
| `typecheck` | `tsc --noEmit` |
| `test` | `bun test` |
| `build` | `bun build src/chat/index.html --outdir dist/chat` (proves the chat page bundles) |
| `fake-api` | `bun scripts/fake-api.ts` |
| `darwin-probe` | `bun scripts/darwin-probe.ts` |

`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `jsx: react-jsx`,
`moduleResolution: bundler`, `types: ["bun"]`, `noEmit`.

## Config (`src/config.ts`)
| Variable | Default | Notes |
| --- | --- | --- |
| `API_URL` | `http://127.0.0.1:8000` | trailing slash stripped |
| `MODEL` | none | required only when the copilot handler is built; `loadConfig` leaves it `undefined` and `createCopilotHandler` throws a clear error naming `MODEL` |
| `DARWIN_MCP_URL` | `https://mcp.darwin.so/mcp` | |
| `APP_ORIGIN` | `http://localhost:5173` | must parse as a URL origin; reject a path or `*` |
| `PORT` | `4000` | integer 0–65535 (0 allowed for tests) |

`.env.example` lists all five plus the provider key the chosen `MODEL` needs
(e.g. `ANTHROPIC_API_KEY=`), with `MODEL=anthropic:claude-sonnet-5-5` as the
example value. Bun loads `.env` itself; no dotenv package. `.env` is gitignored.

## Server (`src/server.ts`)
`Bun.serve` with `port: config.port` and a `fetch` that dispatches by path
prefix to independent handlers: `/api/copilotkit*` → copilot, `/mcp` → cv-tools,
`/chat*` → chat page (spec 04), `GET /health` → `{"status":"ok"}`, else 404.
`createServer` accepts injected handlers so tests can mount a subset (e.g. no
copilot handler when `MODEL` is unset). Run directly, it logs the three URLs.

## Acceptance
- `loadConfig({})` returns the defaults; bad `APP_ORIGIN`/`PORT` throw.
- A test starts `createServer` on port 0 and gets 200 from `/health` and 404
  from `/nope`.
- All four verify commands pass.
