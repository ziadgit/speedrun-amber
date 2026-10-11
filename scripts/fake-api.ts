import { z } from "zod";
import { Profile as ProfileSchema, SaveJobInput, SaveVariantInput, type Profile } from "../src/mcp/schemas";

const TimeSavedInput = z.object({
  task: z.string(),
  seconds_taken: z.number(),
  baseline_seconds: z.number(),
});

const PROFILE: Profile = {
  name: "Ada Example",
  headline: "Backend engineer, payments and data pipelines",
  roles: [
    {
      id: "role-1",
      title: "Senior Backend Engineer",
      company: "Ledgerly",
      start: "2022-03-01",
      end: null,
      bullets: [
        "Designed a double-entry ledger service handling 2M transactions per day.",
        "Cut p99 payment latency from 900ms to 220ms by moving reconciliation off the hot path.",
        "Led migration of 40 services from a monolith to Kubernetes with zero downtime.",
      ],
    },
    {
      id: "role-2",
      title: "Software Engineer",
      company: "Datawise",
      start: "2018-06-01",
      end: "2022-02-28",
      bullets: [
        "Built ETL pipelines in Python and Airflow processing 5TB daily.",
        "Introduced contract testing that removed a class of integration outages.",
        "Mentored four junior engineers through their first production launches.",
      ],
    },
  ],
  projects: [
    {
      id: "proj-1",
      name: "openfx",
      bullets: [
        "Open-source currency conversion library with 1.2k GitHub stars.",
        "Added a pluggable rate-provider interface adopted by three downstream projects.",
        "Maintains CI with property-based tests across Python 3.10 to 3.13.",
      ],
    },
  ],
};

/** In-memory stand-in for the FastAPI side of spec 02. Dev only. */
export function createFakeApi(
  port = 8000,
  options: { emptyProfile?: boolean } = { emptyProfile: process.env.FAKE_API_EMPTY_PROFILE === "1" },
) {
  let profile: Profile | undefined = options.emptyProfile ? undefined : PROFILE;
  const jobs = new Map<string, unknown>();
  const variants: unknown[] = [];
  let totalSaved = 0;
  let entries = 0;

  const json = (data: unknown, status = 200) => Response.json(data, { status });

  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      const res = await route(req, pathname);
      console.log(`${req.method} ${pathname} -> ${res.status}`);
      return res;
    },
  });

  async function body(req: Request): Promise<unknown> {
    return req.json().catch(() => undefined);
  }

  async function route(req: Request, path: string): Promise<Response> {
    const key = `${req.method} ${path}`;
    if (key === "GET /health") return json({ ok: true });
    if (key === "GET /profile") return profile ? json(profile) : json({ detail: "no profile" }, 404);
    if (key === "PUT /profile") {
      const parsed = ProfileSchema.safeParse(await body(req));
      if (!parsed.success) return json({ detail: parsed.error.issues }, 422);
      profile = parsed.data;
      return json(profile);
    }
    if (key === "POST /jobs") {
      const parsed = SaveJobInput.safeParse(await body(req));
      if (!parsed.success) return json({ detail: parsed.error.issues }, 422);
      const id = `job-${jobs.size + 1}`;
      const job = { id, ...parsed.data, url: parsed.data.url ?? null, created_at: new Date().toISOString() };
      jobs.set(id, job);
      return json(job);
    }
    if (key === "POST /cv/variants") {
      const parsed = SaveVariantInput.safeParse(await body(req));
      if (!parsed.success) return json({ detail: parsed.error.issues }, 422);
      if (!jobs.has(parsed.data.job_id)) return json({ detail: "job not found" }, 404);
      const variant = { id: `var-${variants.length + 1}`, ...parsed.data, created_at: new Date().toISOString() };
      variants.push(variant);
      return json(variant);
    }
    if (key === "POST /time-saved") {
      const parsed = TimeSavedInput.safeParse(await body(req));
      if (!parsed.success) return json({ detail: parsed.error.issues }, 422);
      totalSaved += Math.max(0, parsed.data.baseline_seconds - parsed.data.seconds_taken);
      entries += 1;
      return json({ total_seconds_saved: totalSaved, entries });
    }
    return json({ detail: "not found" }, 404);
  }
}

if (import.meta.main) {
  const server = createFakeApi(Number(process.env.FAKE_API_PORT) || 8000);
  console.log(`fake-api listening on http://127.0.0.1:${server.port}`);
}
