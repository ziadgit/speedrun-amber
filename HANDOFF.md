# HANDOFF — what the main repo (`sinaatalay/speedhack`) needs

The Ralph loop in this repo never touches the main repo. A person (or a
separate session in that repo) makes these three changes. The REST contract is
`specs/02-cv-tools.md`; until the real routes exist, `bun run fake-api` stands
in for them.

## 1. Four FastAPI routes in `backend/src/backend/main.py`
Plain in-memory storage, no model calls. One test each in `backend/tests/test_main.py`.

| Route | Body | Returns |
| --- | --- | --- |
| `GET /profile` | none | `Profile` |
| `POST /jobs` | `{title, company, description, url?}` | `Job` (with `id`, `created_at`) |
| `POST /cv/variants` | `{job_id, bullets: [{source_id, text}]}` | `Variant`; 404 if `job_id` unknown |
| `PUT /profile` | a full `Profile` | the stored `Profile`; replaces the old one. `GET /profile` returns 404 until one exists (spec 07) |
| `POST /time-saved` | `{task, seconds_taken, baseline_seconds}` | `{total_seconds_saved, entries}` |

Full shapes are in `specs/02-cv-tools.md`. The SvelteKit page will also want
`GET /jobs`, `GET /cv/variants` and `GET /time-saved` to list what was saved;
those are the main repo's call and the agent does not use them.

## 2. `AGENT_URL` in `frontend/src/env.ts`
Default `http://localhost:4000`, declared next to `API_URL`.

## 3. A chat page on its own route (not `/`, which is prerendered)
- An iframe of `AGENT_URL/chat`.
- A `message` listener that ignores anything whose `event.origin` is not the
  origin of `AGENT_URL`, then for `{type: "speedhack:changed", resource}` calls
  `.refresh()` on the matching query (`profile`, `jobs`, `variants`, `time-saved`).
- The agent server only allows framing from `APP_ORIGIN` (default
  `http://localhost:5173`), so set that on the agent side if the app runs elsewhere.

## Decisions for the main repo's owner
- This breaks the README's "the browser only ever talks to SvelteKit" rule: the
  browser also loads the agent server, which must be public when deployed.
  FastAPI stays private.
- The master profile comes from a CV the user attaches in the chat (spec 07). The
  agent saves it with `PUT /profile` after the user confirms a summary.
- `save_job` stores whatever `url` the agent passes, including `javascript:`.
  Check the scheme is `http`/`https` before rendering a job URL as a link.
