# DONE — completed fix_plan sections, oldest first

### Dev API — ⚡ high
- [x] P0 `scripts/fake-api.ts` with `createFakeApi(port)` + tests; round-trip test: SDK `Client` → `/mcp` → fake API, `save_job` then `save_variant` (spec 05, spec 02)

### Job boards fallback — ⚡ high
- [x] P1 Boards probe: fetch one live board per provider, correct the URL/shape table in spec 06 (spec 06)
- [x] P1 `search_jobs` tool with fixture-based tests, registered in cv-tools; add the instructions line (spec 06) blocked-by: boards probe
