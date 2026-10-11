/** In-memory stand-in for AviCV's FastAPI (spec 08 "Fake API"). Dev only; never imported by src/. */

export const SEEDED_RESUME_ID = "00000000000000000000000000000001";
const MAX_BYTES = 10 * 1024 * 1024;
const GOOD_THRESHOLD = 0.8;

type Fixture = [company: string, title: string, location: string, workplace: string, salary: number | null, provider: string];

const FIXTURES: Fixture[] = [
  ["Acme", "Senior Backend Engineer", "San Francisco, CA", "hybrid", 190000, "greenhouse"],
  ["Acme", "Staff Platform Engineer", "Remote - US", "remote", 220000, "greenhouse"],
  ["Ledgerly", "Payments Engineer", "New York, NY", "hybrid", 175000, "lever"],
  ["Ledgerly", "Data Platform Engineer", "Remote - US", "remote", 180000, "lever"],
  ["Datawise", "Python Backend Developer", "Toronto, ON", "onsite", 150000, "ashby"],
  ["Datawise", "Airflow Pipeline Engineer", "Remote - Canada", "remote", 145000, "ashby"],
  ["Northwind", "Site Reliability Engineer", "Seattle, WA", "onsite", 185000, "greenhouse"],
  ["Northwind", "Kubernetes Engineer", "Remote - US", "remote", 195000, "greenhouse"],
  ["Globex", "Frontend Engineer", "Austin, TX", "hybrid", 160000, "lever"],
  ["Globex", "Full Stack Engineer", "Remote - US", "remote", 170000, "lever"],
  ["Initech", "Engineering Manager", "Chicago, IL", "hybrid", 230000, "ashby"],
  ["Initech", "Security Engineer", "Boston, MA", "onsite", 200000, "ashby"],
  ["Umbrella", "Machine Learning Engineer", "Remote - US", "remote", 210000, "greenhouse"],
  ["Umbrella", "Backend Engineer, Billing", "Denver, CO", "hybrid", 165000, "greenhouse"],
  ["Hooli", "Rust Systems Engineer", "Palo Alto, CA", "onsite", 215000, "lever"],
  ["Hooli", "Developer Advocate", "Remote - US", "remote", null, "lever"],
  ["Stark Labs", "Embedded Software Engineer", "Vancouver, BC", "onsite", 140000, "ashby"],
  ["Stark Labs", "QA Automation Engineer", "Remote - Canada", "remote", 120000, "ashby"],
  ["Wayne Tech", "Backend Engineer, Ledger", "Remote - US", "remote", 185000, "greenhouse"],
  ["Wayne Tech", "Product Designer", "Los Angeles, CA", "hybrid", null, "greenhouse"],
];

const jobKey = (index: number) => `${FIXTURES[index]![5]}:${FIXTURES[index]![0].toLowerCase().replace(/\W+/g, "")}:${1000 + index}`;

const jobUrl = (index: number) => `https://jobs.example.com/${1000 + index}`;

// Fixture indexes of the six matches, best first; the first three are "good" (> 0.8).
const MATCH_ORDER = [0, 18, 2, 3, 1, 13];
const MATCH_SCORES = [0.93, 0.9, 0.84, 0.77, 0.71, 0.62];

function matchFor(index: number, rank: number) {
  const [company, title, location, workplace, salary] = FIXTURES[index]!;
  const score = MATCH_SCORES[rank]!;
  return {
    job_id: 500 + index,
    job_key: jobKey(index),
    title,
    company,
    locations: [location],
    workplace_type: workplace,
    url: jobUrl(index),
    salary_min: salary,
    salary_max: salary === null ? null : salary + 20000,
    salary_currency: salary === null ? null : "USD",
    salary_interval: salary === null ? null : "year",
    posted_at: "2026-10-01",
    score,
    fit: score,
    interview: Math.max(0, score - 0.05),
    must_haves: Math.min(1, score + 0.03),
    location: 1,
    seniority: "matches",
    provider: FIXTURES[index]![5],
    board: company.toLowerCase().replace(/\W+/g, ""),
    source_id: String(1000 + index),
    catalog_status: "open",
    questions_version: "q1",
    model: "fake",
    source_status: "ok",
    source_verified_at: "2026-10-11T00:00:00+00:00",
    source_stale: false,
  };
}

const CV = {
  name: "Ada Example",
  headline: "Backend engineer, payments and data pipelines",
  location: "San Francisco, CA",
  sections: [
    {
      title: "Experience",
      entry_type: "ExperienceEntry",
      entries: [
        {
          company: "Ledgerly",
          position: "Senior Backend Engineer",
          start_date: "2022-03",
          highlights: [
            "Designed a double-entry ledger service handling 2M transactions per day.",
            "Cut p99 payment latency from 900ms to 220ms by moving reconciliation off the hot path.",
          ],
        },
        {
          company: "Datawise",
          position: "Software Engineer",
          start_date: "2018-06",
          end_date: "2022-02",
          highlights: ["Built ETL pipelines in Python and Airflow processing 5TB daily."],
        },
      ],
    },
    { title: "Skills", entry_type: "OneLineEntry", entries: [{ label: "Languages", details: "Python, Go, SQL" }] },
  ],
};

const RESUME_STEPS = ["queued", "parsing", "matching", "done"] as const;
const TAILOR_STEPS = ["queued", "tailoring", "ready"] as const;

type ResumeState = { id: string; filename: string | null; step: number; location: string | null };
type TailoredState = { id: string; resumeId: string; jobKey: string; step: number };

export function createFakeApi(port = 8000) {
  const resumes = new Map<string, ResumeState>([
    [SEEDED_RESUME_ID, { id: SEEDED_RESUME_ID, filename: "ada-example.pdf", step: RESUME_STEPS.length - 1, location: CV.location }],
  ]);
  const tailored = new Map<string, TailoredState>();

  const json = (data: unknown, status = 200) => Response.json(data, { status });
  const notFound = (detail: string) => json({ detail }, 404);

  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const res = await route(req, url);
      console.log(`${req.method} ${url.pathname}`);
      return res;
    },
  });

  function resumeBody(r: ResumeState) {
    const status = RESUME_STEPS[r.step]!;
    const total = status === "matching" || status === "done" ? MATCH_ORDER.length : 0;
    const done = status === "done" ? total : 0;
    return {
      id: r.id,
      status,
      error: null,
      filename: r.filename,
      created_at: "2026-10-11T00:00:00+00:00",
      preview: r.step >= 1 ? { name: CV.name, sections: CV.sections.map((s) => s.title) } : null,
      cv: r.step >= 2 ? { ...CV, location: r.location } : null,
      rendercv_yaml: r.step >= 2 ? "cv:\n  name: Ada Example\n" : null,
      progress: { done, total, attempted: done, succeeded: done, failed: 0, pending: total - done },
      search: null,
      cost_usd: 0,
      effective_location: r.step >= 2 ? r.location : null,
      location_source: r.location ? "resume" : "unknown",
      results_are_previous: false,
    };
  }

  /** Reading an in-progress résumé moves it one step forward, after returning the current state. */
  function readResume(r: ResumeState) {
    const body = resumeBody(r);
    if (r.step < RESUME_STEPS.length - 1) r.step += 1;
    return body;
  }

  function tailoredBody(t: TailoredState) {
    const status = TAILOR_STEPS[t.step]!;
    return {
      id: t.id,
      status,
      error: null,
      download_url: status === "ready" ? `/resumes/${t.resumeId}/tailored/${t.id}/cv.pdf` : null,
      design_source: "default",
    };
  }

  function matchResults(url: URL) {
    const category = url.searchParams.get("category") ?? "all";
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const all = MATCH_ORDER.map((index, rank) => matchFor(index, rank));
    const good = all.filter((m) => m.score > GOOD_THRESHOLD);
    const filtered = category === "good" ? good : category === "other" ? all.filter((m) => m.score <= GOOD_THRESHOLD) : all;
    const items = filtered.slice(offset, offset + limit);
    return {
      items,
      total: filtered.length,
      good_total: good.length,
      other_total: all.length - good.length,
      unfiltered_total: all.length,
      nearby_total: all.length,
      closed_total: 0,
      offset,
      limit,
      has_more: offset + items.length < filtered.length,
      candidate_location_known: true,
      effective_location: CV.location,
      location_source: "resume",
      results_are_previous: false,
    };
  }

  function jobSummary(index: number) {
    const [company, title, location, workplace, salary, provider] = FIXTURES[index]!;
    return {
      id: 500 + index,
      provider,
      company,
      title,
      locations: location,
      geo_bucket: "us_ca",
      workplace_type: workplace,
      employment_type: "full_time",
      posted_at: "2026-10-01",
      url: jobUrl(index),
      salary_min: salary,
      salary_max: salary === null ? null : salary + 20000,
      salary_currency: salary === null ? null : "USD",
      salary_interval: salary === null ? null : "year",
      source_status: "ok",
      source_verified_at: "2026-10-11T00:00:00+00:00",
      source_stale: false,
    };
  }

  function searchJobs(url: URL) {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const hits = FIXTURES.map((_, i) => i).filter((i) => {
      const [company, title, location] = FIXTURES[i]!;
      return !q || `${company} ${title} ${location}`.toLowerCase().includes(q);
    });
    return { synced: true, total: hits.length, jobs: hits.slice(0, limit).map(jobSummary) };
  }

  function jobStats() {
    const by_provider: Record<string, number> = {};
    for (const f of FIXTURES) by_provider[f[5]] = (by_provider[f[5]] ?? 0) + 1;
    return {
      synced: true,
      open_jobs: FIXTURES.length,
      by_provider,
      by_geo: { us_ca: FIXTURES.length },
      last_run: { status: "ok", started_at: "2026-10-11T00:00:00+00:00", finished_at: "2026-10-11T00:05:00+00:00" },
      last_success_at: "2026-10-11T00:05:00+00:00",
      sources: [],
      stale_sources: 0,
    };
  }

  async function upload(req: Request): Promise<Response> {
    const form = await req.formData().catch(() => undefined);
    const file = form?.get("file");
    if (!(file instanceof File)) return json({ detail: [{ msg: "Field required", loc: ["body", "file"] }] }, 422);
    const data = new Uint8Array(await file.arrayBuffer());
    if (data.length > MAX_BYTES) return json({ detail: "Upload a PDF smaller than 10 MB." }, 413);
    if (!new TextDecoder("latin1").decode(data.slice(0, 1024)).includes("%PDF-")) return json({ detail: "Upload a PDF." }, 415);
    const id = crypto.randomUUID().replaceAll("-", "");
    resumes.set(id, { id, filename: file.name || null, step: 0, location: CV.location });
    return json({ id }, 202);
  }

  async function route(req: Request, url: URL): Promise<Response> {
    const path = url.pathname;
    const method = req.method;
    if (method === "GET" && path === "/health") return json({ ok: true });
    if (method === "GET" && path === "/jobs") return json(searchJobs(url));
    if (method === "GET" && path === "/jobs/stats") return json(jobStats());
    if (method === "POST" && path === "/resumes") return upload(req);

    const m = path.match(/^\/resumes\/([^/]+)(?:\/(.*))?$/);
    if (!m) return notFound("Not Found");
    const resume = resumes.get(m[1]!);
    if (!resume) return notFound("Résumé not found.");
    const rest = m[2] ?? "";
    const done = resume.step === RESUME_STEPS.length - 1;

    if (method === "GET" && rest === "") return json(readResume(resume));
    if (method === "GET" && rest === "match-results") return json(matchResults(url));
    if (method === "GET" && rest === "time-savings") {
      const cvs = [...tailored.values()].filter((t) => t.resumeId === resume.id && TAILOR_STEPS[t.step] === "ready").length;
      const jobs = done ? MATCH_ORDER.length : 0;
      return json({
        jobs_reviewed: jobs,
        cvs_tailored: cvs,
        job_review_seconds: 30,
        cv_tailoring_seconds: 600,
        estimated_seconds: jobs * 30 + cvs * 600,
      });
    }
    if (method === "POST" && rest === "tailor") {
      const body = (await req.json().catch(() => undefined)) as { job_key?: unknown } | undefined;
      if (typeof body?.job_key !== "string" || !body.job_key) return json({ detail: [{ msg: "Field required", loc: ["body", "job_key"] }] }, 422);
      if (!done) return json({ detail: "Wait for résumé parsing to finish before tailoring a CV." }, 422);
      if (!MATCH_ORDER.some((index) => jobKey(index) === body.job_key)) return notFound("This job isn't a saved match for the résumé.");
      const id = crypto.randomUUID().replaceAll("-", "");
      const t = { id, resumeId: resume.id, jobKey: body.job_key, step: 0 };
      tailored.set(id, t);
      return json(tailoredBody(t), 202);
    }
    const tm = rest.match(/^tailored\/([^/]+)(\/cv\.pdf)?$/);
    if (method === "GET" && tm) {
      const t = tailored.get(tm[1]!);
      if (!t || t.resumeId !== resume.id) return notFound("Tailored CV not found.");
      if (tm[2]) {
        if (TAILOR_STEPS[t.step] !== "ready") return json({ detail: "This tailored CV is still being prepared." }, 409);
        return new Response("%PDF-1.4\n% fake tailored CV\n", { headers: { "content-type": "application/pdf" } });
      }
      const body = tailoredBody(t);
      if (t.step < TAILOR_STEPS.length - 1) t.step += 1;
      return json(body);
    }
    if (method === "POST" && rest === "rematch") {
      if (!done) return json({ detail: "Wait for résumé parsing to finish before rematching." }, 409);
      const body = (await req.json().catch(() => undefined)) as { location?: unknown } | undefined;
      if (body?.location !== undefined && body.location !== null) {
        if (typeof body.location !== "string" || body.location.length < 1 || body.location.length > 200) {
          return json({ detail: [{ msg: "Invalid location", loc: ["body", "location"] }] }, 422);
        }
        resume.location = body.location.trim();
      }
      resume.step = 0;
      return json({ id: resume.id }, 202);
    }
    return notFound("Not Found");
  }
}

if (import.meta.main) {
  const server = createFakeApi(Number(process.env.FAKE_API_PORT) || 8000);
  console.log(`fake-api listening on http://127.0.0.1:${server.port}`);
}
