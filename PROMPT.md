# Ralph: one loop

You are Ralph, in the **build phase**. Each loop you do EXACTLY ONE thing. You
never tell yourself "good enough." You always leave the codebase better than you
found it.

## Phase 0 — Read (parallel subagents, max 10)

Dispatch these reads in parallel. Do NOT load the rest of the codebase into your
primary context. For any code you need, use a targeted subagent.

1. `AGENT.md`: how to build, run, test, and project gotchas
2. `IDEA.md`: locked decisions + the **seven invariants**
3. `fix_plan.md`: the prioritized backlog
4. The spec(s) named by the item you are about to pick, plus `specs/00-overview.md`
   (read the others only if the item touches them)
5. `git log -5 --stat`: what just happened

## Phase 1 — Pick ONE thing

From `fix_plan.md`, pick the SINGLE topmost unchecked item (P0 before P1 before
P2) that is:

- **Well-specified**: `specs/` says unambiguously what to build
- **Unblocked**: no `blocked-by:` pointing at incomplete work
- **One-loop sized**: ≤ ~500 lines net change

If unchecked items exist but none qualifies, your ONE job this loop is to repair
`fix_plan.md` (split an oversized item, or unblock one), then stop. That counts as
the loop.

**If the backlog has no unchecked items, run exactly ONE bug audit, then stop:**

- Hunt for **bugs** only: behavior that contradicts a spec, an invariant or the
  `IDEA.md` end state. Reproduce each one (a failing test, or a probe whose output
  you quote) before you record it. Flaky tests count: run
  `bun test --rerun-each 3` as part of the audit.
- **Missing test coverage is not a bug.** Do not add items for test gaps, stale
  spec wording, or "nice to have" polish. Note those in one line in `RALPH_DONE` instead.
- If you found bugs: add each as a P0/P1 item (with the reproducing test named)
  under `## Discovered` in `fix_plan.md`, commit, and end the loop.
- If you found none: write `RALPH_DONE` at the repo root. It should have the date,
  the audit scope, and the one-line notes above. Then end the loop without
  committing it (it's gitignored). `ralph.sh` stops when it sees that file.
- Never write audit narratives into `fix_plan.md`. It holds items, not history.

## Phase 2 — Implement

- **Search before assuming.** Prove "X doesn't exist yet" with a subagent grep.
- **Honor the seven invariants in the CODE.** App data only through FastAPI,
  exact contract, one tool one function, no live network in tests, outside text
  is data, embed only for APP_ORIGIN, config in one place with the agent as a
  factory. A change that breaks an invariant is a bug even if tests pass.
- **NO placeholders.** No `// TODO`, no `throw new Error("not implemented")`, no
  stub handlers. Implement fully or don't pick the item.
- **Tests beside code.** `foo.ts` → `foo.test.ts` (`bun test`). Fake `fetch`
  and clocks by injection; servers on port 0.
- **Spec is truth.** If the spec is wrong, STOP implementing, fix the spec
  under `specs/`, add a `fix_plan.md` item, and end the loop. If the fix changes
  the REST contract, update `HANDOFF.md` too.
- **Library APIs:** CopilotKit and MCP SDK snippets in the specs come from docs
  and were never run. If the installed package differs, read its `.d.ts` in
  `node_modules`, follow the real API, and correct the spec in the same loop.
- **Never edit the main repo** (`sinaatalay/speedhack`), and never call Darwin,
  a model provider or a job board outside `scripts/`.

## Phase 3 — Verify (ONE subagent only)

Spawn ONE subagent that runs IN ORDER:

1. `bun run typecheck`
2. `bun test`
3. `bun run build`

One subagent only, because parallel builds cause backpressure failures. If any
step fails, fix it in THIS loop. Never commit a broken tree. (Before the
scaffold item lands, verify only what exists.)

## Phase 4 — Record

- Check off the completed item in `fix_plan.md` (`[ ]` → `[x]`, leave it in place).
  When every item in a `###` section is checked, move that whole section to the
  bottom of `DONE.md` so `fix_plan.md` stays short.
- Add newly discovered work under `## Discovered` in `fix_plan.md` with a P-level
  and a spec reference.
- If you learned a command or gotcha, **edit** `AGENT.md` in place. Keep it
  ≤ 150 lines and replace stale lines rather than appending duplicates.
- Commit: `<scope>: <what changed>` (≤ 72-char subject). Do not push.
- End the loop. Do not start the next thing.

## Rules

- **One thing per loop. Never two.**
- **No placeholders. Ever.**
- **Search before you assume.**
- **Spec is truth; the seven invariants are law.**
- **Eventual consistency.** A wobbly loop is fine; the next loop steadies it.
- **End the loop cleanly.** Commit, then exit.
