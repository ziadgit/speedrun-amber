# HANDOFF — wiring the agent into AviCV

The Ralph loop in this repo never touches AviCV (`sinaatalay/avicv`). A person
(or a separate session in that repo) makes the two changes below. **AviCV's
backend needs no new routes**: the agent drives the routes it already has
(`/resumes`, `/resumes/{id}/match-results`, `/resumes/{id}/tailor`,
`/resumes/{id}/time-savings`, `/jobs`, `/jobs/stats`). The contract is
`specs/08-avicv.md`; until AviCV runs locally, `bun run fake-api` stands in.

## 1. `AGENT_URL` in `frontend/src/env.ts`
Declare it next to `API_URL`, default `http://localhost:4000` (use the agent's
`PORT`; on a Mac where 4000 is NoMachine, that is 4001):

```ts
AGENT_URL: {
	description: 'Base URL of the AviCV agent server, as reached from the browser',
	schema: (value) => value || 'http://localhost:4000'
}
```

## 2. Embed the chat on `routes/resumes/[id]/+page.svelte`
- An iframe of `${AGENT_URL}/chat?resume=${id}`. The page already holds the
  résumé id; the agent uses it as `avicv_resume_id`.
- A `message` listener that ignores anything whose `event.origin` is not the
  origin of `AGENT_URL`. For `{type: "avicv:changed", resource}`:
  - `"resume"` (after `rematch`): refresh `watchResume`.
  - `"tailored"` (after `tailor_cv` / `get_tailored_cv`): refresh `watchResume`
    and the time-savings data the page loads for `TimeSavings.svelte`.
- The agent only allows framing from `APP_ORIGIN` (default
  `http://localhost:5173`), so set that on the agent side if AviCV runs elsewhere.

## Decisions for AviCV's owner
- This breaks "the browser only ever talks to SvelteKit": the browser also loads
  the agent server, which must be public when deployed. FastAPI stays private.
- A résumé id is a bearer capability. It appears in the iframe URL and in the
  agent's `/chat/avicv/*` proxy paths, and the agent keeps it in `localStorage`
  on the standalone page.
- Tailored-CV download links are `${APP_ORIGIN}/resumes/{id}/tailored/{aid}/cv.pdf`,
  served by AviCV's frontend. The agent never links to `API_URL`.
