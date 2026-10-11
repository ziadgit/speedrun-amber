# avicv agent

**An AI career agent that finds the job, tailors the CV, and tells you how much time it saved.**

avicv agent is the AI half of [avicv](https://github.com/sinaatalay/speedhack). Drop in your CV and say *"tailor my CV for a backend role at Stripe"*. The agent reads your CV, finds the role on the company's job board, rewrites your bullets for it, and saves everything into the app. It never makes up experience you don't have.

One Bun process. No database. 74 tests, none of which touch the network.

```
 ┌──────────────── avicv (SvelteKit) ────────────────┐
 │   your app page                                   │
 │   ┌───────────── <iframe> /chat ──────────────┐   │       ┌──────────────┐
 │   │  React + CopilotKit chat                  │   │       │   Anthropic   │
 │   │  📎 drop your CV (PDF · DOCX · MD · TXT)  │   │       │    Claude     │
 │   └───────────────────┬───────────────────────┘   │       └──────▲───────┘
 │     ▲ postMessage     │                           │              │
 │     │ "profile changed, refresh"                  │              │
 └─────┼─────────────────┼───────────────────────────┘              │
       │                 ▼                                          │
 ┌─────┴──────────── avicv agent (Bun, one process) ───────────────┼──┐
 │  /chat            → bundled React page, CSP-locked to the app   │  │
 │  /api/copilotkit  → CopilotKit runtime, BuiltInAgent ───────────┘  │
 │  /mcp             → cv-tools MCP server (loopback only)            │
 │  /health                                                           │
 └──────────────┬─────────────────────────────────┬───────────────────┘
                ▼                                 ▼
       FastAPI (API_URL)                 Darwin MCP · Greenhouse · Lever · Ashby
       profile · jobs · variants          job search
       time saved
```

## What the agent can do

| Tool | What it does |
| --- | --- |
| `get_profile` | Reads your master CV: roles, projects, bullets |
| `save_profile` | Saves a profile parsed from your uploaded CV, after you confirm the summary |
| `search_jobs` | Lists open roles on a company's Greenhouse, Lever, or Ashby board |
| `save_job` | Saves a job posting you're interested in |
| `save_variant` | Saves a tailored CV. Every bullet cites the role or project it came from |
| `log_time_saved` | Records time saved against a fixed baseline (20 min to find jobs, 30 min to tailor a CV) |

Darwin's `search` also comes through from its MCP server. Only `search` is used: Darwin's other tools have schemas Anthropic rejects.

## Quick start

```sh
bun install
cp .env.example .env          # add ANTHROPIC_API_KEY
bun run fake-api              # shell 1: FastAPI stand-in on :8000
bun run dev                   # shell 2: agent on :4000 (set PORT if 4000 is taken)
open http://localhost:4000/chat
```

To try CV upload from scratch, start the fake API with no profile:

```sh
FAKE_API_EMPTY_PROFILE=1 bun run fake-api
```

Then attach a CV in the chat, confirm the summary, and ask for a tailored version.

## Configuration

Everything is read in one place, `src/config.ts`.

| Variable | Default | |
| --- | --- | --- |
| `API_URL` | `http://127.0.0.1:8000` | avicv's FastAPI, the only source of app data |
| `MODEL` | `anthropic:claude-sonnet-5-5` | `provider:model` |
| `ANTHROPIC_API_KEY` | none | Use a workspace-scoped key |
| `ANTHROPIC_WORKSPACE_ID` | none | Only needed for an org-level key |
| `DARWIN_MCP_URL` | `https://mcp.darwin.so/mcp` | |
| `APP_ORIGIN` | `http://localhost:5173` | The only origin allowed to embed `/chat` |
| `PORT` | `4000` | |

## Commands

| Command | |
| --- | --- |
| `bun run dev` | Server with hot reload. Bun reads `.env` only at startup, so restart after editing it |
| `bun run start` | Server without hot reload |
| `bun run fake-api` | In-memory FastAPI stand-in on :8000 |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Unit and in-process server tests, no live network |
| `bun run build` | Bundles the chat page into `dist/chat` |
| `bun run darwin-probe` | One live Darwin search |

## Design rules

These seven rules are spelled out in [`IDEA.md`](IDEA.md), and the code follows them:

1. **App data comes only from FastAPI.** The agent has no storage of its own. Uploaded CVs stay in the chat thread until you confirm them.
2. **The contract is exact.** [`specs/02-cv-tools.md`](specs/02-cv-tools.md) defines it, and zod checks every request and response.
3. **One tool, one function.** Each tool is a plain function you can test with a fake `fetch`.
4. **No live network in tests.**
5. **Outside text is data.** Job posts and uploaded CVs never become instructions. Job URLs must be `https:`.
6. **Only `APP_ORIGIN` can embed the chat.** `/chat` sends `frame-ancestors` in its CSP, and `/mcp` only answers loopback requests with a matching `Host` header.
7. **Config lives in `config.ts`, and the agent is built by a factory.**

## Layout

```
src/
  server.ts         route dispatch: /chat /mcp /api/copilotkit /health
  config.ts         loadConfig(env), the only env reader
  runtime.ts        CopilotKit runtime + model
  darwin.ts         Darwin MCP, `search` only
  instructions.ts   system prompt
  mcp/              cv-tools: tools.ts, schemas.ts, server.ts
  chat/             React page, CV attachments (DOCX → text via mammoth)
specs/              00–07, the source of truth
```

## Wiring it into avicv

[`HANDOFF.md`](HANDOFF.md) lists what the main app needs:

- Five FastAPI routes.
- An `AGENT_URL` setting.
- An iframe page that listens for `speedhack:changed` messages (the message name predates the rename) and refreshes its data.

## How this was built

avicv agent was written by a [Ralph loop](ralph.sh): `claude --print` in a loop that does one `fix_plan.md` item per run, against hand-written specs. Each run passes typecheck, tests, and build before it commits. When the plan is empty and a bug audit comes back clean, the loop writes `RALPH_DONE` and stops. A human reviews between rounds and queues the next fixes.

```sh
MAX_ITERATIONS=5 ./ralph.sh
```
