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
| `PORT` | `4000` | integer 0–65535 (0 allowed for tests); empty counts as unset, like the others |

`.env.example` lists all five plus the provider key the chosen `MODEL` needs
(e.g. `ANTHROPIC_API_KEY=`), with `MODEL=anthropic:claude-sonnet-5-5` as the
example value, plus `COPILOTKIT_TELEMETRY_DISABLED=true`. The missing-`MODEL`
error's example uses the same `anthropic:` form. Bun loads `.env` itself; no dotenv package. `.env` is gitignored.

## Server (`src/server.ts`)
`Bun.serve` with `port: config.port` and a `fetch` that dispatches by path
prefix to independent handlers: `/api/copilotkit*` → copilot, `/mcp` → cv-tools,
`/chat*` → chat page (spec 04), `GET /health` → `{"status":"ok"}`, else 404.
`createServer` accepts injected handlers so tests can mount a subset (e.g. no
copilot handler when `MODEL` is unset). Run directly, it logs the three URLs.

**`/mcp` is loopback-only.** `/chat` must be public (the app iframes it), but
only the agent, in this same process, calls `/mcp`. The server's `fetch(req, server)`
rejects any `/mcp*` request whose `server.requestIP(req)?.address` is not
`127.0.0.1`, `::1` or `::ffff:127.0.0.1` (or is unknown) with 403
`{"error":"forbidden"}`, before the cv-tools handler runs. `ServerDeps` takes an
optional `clientIp(req) => string | undefined` so tests can simulate a remote
address. Tests: a remote IP gets 403 and the MCP handler is not called; the real
loopback client in the existing MCP tests still works.
`/api/copilotkit` stays public for the chat page. Protecting it is out of scope.

**`/mcp` also checks the Host header** (blocks DNS rebinding: a web page in the
user's browser whose domain resolves to 127.0.0.1 would pass the IP check). After
the IP check, reject with the same 403 unless `Host` is exactly `127.0.0.1:<port>`,
`localhost:<port>` or `[::1]:<port>`, where `<port>` is the bound `server.port`.
The agent's own MCP URL (`http://127.0.0.1:<port>/mcp`) passes. Tests: a
loopback request with `Host: evil.example:<port>` gets 403 and the handler is
not called; the existing MCP client tests still pass.

## Acceptance
- `loadConfig({})` returns the defaults; bad `APP_ORIGIN`/`PORT` throw.
- A test starts `createServer` on port 0 and gets 200 from `/health` and 404
  from `/nope`.
- All four verify commands pass.
