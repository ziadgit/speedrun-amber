# AviCV agent

**A chat agent for [AviCV](https://github.com/sinaatalay/avicv): it finds the jobs that fit your CV, tailors a CV PDF for one, and tells you how much time it saved.**

AviCV already parses your CV, ingests open roles, ranks them and renders tailored PDFs. This agent is the conversational front end: say *"show my best matches and tailor my CV for the top one"* and it calls AviCV's own API. It never makes up jobs, scores or experience.

One Bun process. No database. Tests never touch the network.

```
 ┌──────────────── AviCV (SvelteKit) ────────────────┐
 │   /resumes/[id]                                   │
 │   ┌───────────── <iframe> /chat?resume=id ────┐   │       ┌──────────────┐
 │   │  React + CopilotKit chat                  │   │       │   Anthropic   │
 │   │  header strip · match cards · PDF card    │   │       │    Claude     │
 │   └───────────────────┬───────────────────────┘   │       └──────▲───────┘
 │     ▲ postMessage     │                           │              │
 │     │ "avicv:changed, refresh"                    │              │
 └─────┼─────────────────┼───────────────────────────┘              │
       │                 ▼                                          │
 ┌─────┴──────────── AviCV agent (Bun, one process) ───────────────┼──┐
 │  /chat            → bundled React page, CSP-locked to the app   │  │
 │  /chat/avicv/*    → small pass-through to AviCV (upload, stats) │  │
 │  /api/copilotkit  → CopilotKit runtime, BuiltInAgent ───────────┘  │
 │  /mcp             → cv-tools MCP server (loopback only)            │
 │  /health                                                           │
 └──────────────┬─────────────────────────────────┬───────────────────┘
                ▼                                 ▼
       AviCV FastAPI (API_URL)              Darwin MCP (secondary)
       résumés · matches · tailoring        job search
       jobs catalog · time savings
```

## What the agent can do

| Tool | What it does |
| --- | --- |
| `get_resume` | Reads your AviCV résumé: status, progress, parsed CV |
| `list_matches` | Jobs AviCV ranked against your CV, best first |
| `search_jobs` | Full-text search over AviCV's catalog of open jobs |
| `job_stats` | How many jobs AviCV has indexed and when it last synced |
| `tailor_cv` | Starts a tailored CV PDF for one of your matches |
| `get_tailored_cv` | Checks a tailored CV and returns its download link |
| `rematch` | Re-ranks your matches, optionally for another location |
| `get_time_savings` | How much time AviCV has saved you |

Darwin's `search` also comes through from its MCP server, as a secondary source. Only `search` is used: Darwin's other tools have schemas Anthropic rejects.

## Quick start

```sh
bun install
cp .env.example .env          # add ANTHROPIC_API_KEY
bun run fake-api              # shell 1: AviCV FastAPI stand-in on :8000
bun run dev                   # shell 2: agent on :4000 (set PORT if 4000 is taken)
open "http://localhost:4000/chat?resume=00000000000000000000000000000001"
```

The fake API seeds that résumé. To start from scratch, open `/chat` with no `resume` param and use "Upload your CV to AviCV" (a PDF, up to 10 MB). Against the real AviCV, run it with `bun run dev` in its repo and point `API_URL` at it.

## Configuration

Everything is read in one place, `src/config.ts`.

| Variable | Default | |
| --- | --- | --- |
| `API_URL` | `http://127.0.0.1:8000` | AviCV's FastAPI, the only source of app data |
| `MODEL` | `anthropic:claude-sonnet-5-5` | `provider:model` |
| `ANTHROPIC_API_KEY` | none | Use a workspace-scoped key |
| `ANTHROPIC_WORKSPACE_ID` | none | Only needed for an org-level key |
| `DARWIN_MCP_URL` | `https://mcp.darwin.so/mcp` | |
| `APP_ORIGIN` | `http://localhost:5173` | AviCV's frontend: the only origin allowed to embed `/chat`, and the base of download and page links |
| `PORT` | `4000` | |

## Commands

| Command | |
| --- | --- |
| `bun run dev` | Server with hot reload. Bun reads `.env` only at startup, so restart after editing it |
| `bun run start` | Server without hot reload |
| `bun run fake-api` | In-memory AviCV FastAPI stand-in on :8000 |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Unit and in-process server tests, no live network |
| `bun run build` | Bundles the chat page into `dist/chat` |
| `bun run darwin-probe` | One live Darwin search |

## Design rules

These seven rules are spelled out in [`IDEA.md`](IDEA.md), and the code follows them:

1. **App data comes only from FastAPI.** The agent has no storage of its own. CVs go to AviCV and nowhere else.
2. **The contract is exact.** [`specs/08-avicv.md`](specs/08-avicv.md) defines it, and zod checks every request and response.
3. **One tool, one function.** Each tool is a plain function you can test with a fake `fetch`.
4. **No live network in tests.**
5. **Outside text is data.** Job posts and CV contents never become instructions. Job URLs must be `https:`.
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
  chat/             React page, header strip, cards, AviCV proxy, résumé id
specs/              00–08, the source of truth (08 supersedes 02, 06, 07)
```

## Wiring it into AviCV

[`HANDOFF.md`](HANDOFF.md) lists what AviCV needs. No new backend routes:

- An `AGENT_URL` setting in `frontend/src/env.ts`.
- An iframe of `${AGENT_URL}/chat?resume=${id}` on the résumé page, with a listener for `avicv:changed` messages that refreshes the résumé and time savings.

## How this was built

The AviCV agent was written by a [Ralph loop](ralph.sh): `claude --print` in a loop that does one `fix_plan.md` item per run, against hand-written specs. Each run passes typecheck, tests, and build before it commits. When the plan is empty and a bug audit comes back clean, the loop writes `RALPH_DONE` and stops. A human reviews between rounds and queues the next fixes.

```sh
MAX_ITERATIONS=5 ./ralph.sh
```
