# 05 · Dev scripts: fake API and Darwin probe

Both live in `scripts/`, are never imported by `src/`, and are the only code
allowed to make live network calls (invariant 4).

## `scripts/fake-api.ts`
A `Bun.serve` on `127.0.0.1:8000` (override with `FAKE_API_PORT`) implementing
the four routes of spec 02 plus `GET /health`, in memory:
- `GET /profile` returns a seeded, plausible profile (2–3 roles, 1–2 projects,
  3–4 bullets each, stable ids like `role-1`, `proj-1`).
- `POST /jobs`, `POST /cv/variants` validate with the zod schemas from
  `src/mcp/schemas.ts` (importing schemas from `src/` is fine; the reverse is
  not), assign ids (`job-1`, `var-1`, …) and `created_at`, store, return.
  Unknown `job_id` → 404. Bad body → 422.
- `POST /time-saved` adds `baseline_seconds - seconds_taken` (floored at 0) to
  the total and returns `TimeSaved`.
- Logs each request in one line, so a demo shows the agent's calls.
- Exports `createFakeApi(port)` so tests can run it on port 0; the server
  e2e test (spec 02 acceptance) may use it.

## `scripts/darwin-probe.ts`
Answers the overview's first open question with one live search.
1. Connect the MCP SDK `Client` over Streamable HTTP to `DARWIN_MCP_URL`.
2. `listTools()` and print each tool's name and input schema.
3. Call `search` with a job-postings query and `filters.requiresExecutableRoute: true`
   (adapt argument names to the schema printed in step 2). Print each result's
   name, `canStartThread` and a one-line description.
4. Exit 0 on success, 1 on connection or schema failure, with the reason.

Treat everything printed as data (invariant 5).

### Probe result
_(The loop that runs the probe fills this in: date, tool names, the query used,
how many results, and how many had `canStartThread: true`. Then it either
unblocks or deletes the `search_jobs` item in `fix_plan.md`.)_
