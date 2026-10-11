# 02 · cv-tools: the contract between the repos

cv-tools is an MCP server (Streamable HTTP, stateless or per-session, whichever
the installed SDK supports cleanly under `Bun.serve`) at `/mcp`. Server name
`cv-tools`, version from `package.json`.

This file is the contract. The REST side is what `HANDOFF.md` asks the main repo
to build; `scripts/fake-api.ts` implements the same thing for local dev.

## Shapes (zod in `src/mcp/schemas.ts`, JSON over the wire)
```ts
Bullet   = { source_id: string, text: string }       // source_id = a role or project id from the profile
Role     = { id: string, title: string, company: string, start: string, end: string | null, bullets: string[] }
Project  = { id: string, name: string, bullets: string[] }
Profile  = { name: string, headline: string, roles: Role[], projects: Project[] }
Job      = { id: string, title: string, company: string, description: string, url: string | null, created_at: string }
Variant  = { id: string, job_id: string, bullets: Bullet[], created_at: string }
TimeSaved = { total_seconds_saved: number, entries: number }
```
`start`/`end`/`created_at` are ISO-8601 strings. Responses are validated with
zod; extra fields are allowed and passed through.

## Tools
| Tool | REST call | Tool input | Tool output |
| --- | --- | --- | --- |
| `get_profile` | `GET /profile` | `{}` | `Profile` |
| `save_job` | `POST /jobs` body `{title, company, description, url?}` | same | `Job` |
| `save_variant` | `POST /cv/variants` body `{job_id, bullets}` | `{job_id: string, bullets: Bullet[] (min 1)}` | `Variant` |
| `log_time_saved` | `POST /time-saved` body `{task, seconds_taken, baseline_seconds}` | `{task: TaskName}` | `TimeSaved` |

Tool descriptions (the model reads these, keep them exact in spirit):
- `get_profile`: "Read the user's master CV profile: roles, projects and their bullets. Call this before writing any CV variant."
- `save_job`: "Save a job posting the user is interested in. Returns the stored job with its id."
- `save_variant`: "Save a CV variant tailored to a saved job. Each bullet must cite the source_id of the profile role or project it was rewritten from. Do not invent experience."
- `log_time_saved`: "Record that you finished a task for the user, so the app can show time saved. Call once after each finished task."

### `log_time_saved` deviates from the overview on purpose
The model cannot measure time, so the tool input is only `task`, and the tool
fills the REST body:
- `TaskName` is `"find_jobs" | "tailor_cv"`, with fixed baselines in `tools.ts`:
  `find_jobs` 1200 s, `tailor_cv` 1800 s.
- `seconds_taken` = whole seconds since the **task start**, min 1, via the
  injected clock. Same REST contract as the overview.
- **Task start** is the first cv-tools call (any tool) after server start or
  after the previous `log_time_saved`. Each `log_time_saved` call, success or
  failure, clears it, so the next call starts a new task. It must never be a
  server-lifetime timestamp: a server up for 40 minutes would report
  `seconds_taken` past the baseline and save 0. The handler is stateless, so
  this one value lives in the `createMcpHandler` closure (single-user demo).
- Test: first call at t=0, `log_time_saved` at t=60 s → 60; idle until t=3600 s,
  then a call at 3600 s and `log_time_saved` at 3630 s → 30.

## Results and errors
- Success: MCP result with one `text` content holding the JSON output and, if
  the SDK supports it, `structuredContent` with the same object.
- REST non-2xx, network error, or a response failing zod: `isError: true`
  result whose text is `"<tool> failed: <status or error> <first 300 chars of body>"`.
  Never throw out of a tool. `404` on `save_variant` reads
  `"save_variant failed: job <job_id> not found"`.
- Requests send `content-type: application/json` and a 10 s timeout
  (`AbortSignal.timeout`).

## Acceptance
- Each tool function has a test with a fake `fetch`: correct method, URL
  (`API_URL` + path), body, parsed output, and the error path.
- `log_time_saved` test uses a fake clock and checks the computed body.
- A test connects the SDK `Client` to the `/mcp` handler served on port 0 and
  sees exactly the five tools with the names above.
