import { describe, expect, test } from "bun:test";
import {
  getResume,
  getTailoredCv,
  getTimeSavings,
  jobStats,
  listMatches,
  rematch,
  searchJobs,
  tailorCv,
  type ToolDeps,
  type ToolResult,
} from "./tools";

const ID = "0123456789abcdef0123456789abcdef";

interface Call { url: string; init: RequestInit }

function setup(respond: () => Response | Promise<Response> = () => Response.json({})) {
  const calls: Call[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as unknown as typeof fetch;
  const deps: ToolDeps = { fetch: f, apiUrl: "http://api", appOrigin: "http://app.test" };
  return { deps, calls };
}

const text = (r: ToolResult) => r.content[0]!.text;

describe("get_resume", () => {
  test("GETs the résumé, trims fields and adds page_url", async () => {
    const { deps, calls } = setup(() =>
      Response.json({
        id: ID, status: "done", error: null, filename: "a.pdf", progress: { done: 1, total: 2 },
        rendercv_yaml: "secret", cost_usd: 3, effective_location: "SF",
        cv: { name: "Ada", headline: "Eng", location: "SF", sections: [], extra: 1 },
      }),
    );
    const r = await getResume(deps, { resume_id: ID });
    expect(calls[0]!.url).toBe(`http://api/resumes/${ID}`);
    expect(calls[0]!.init.method).toBe("GET");
    expect(r.structuredContent).toEqual({
      id: ID, status: "done", error: null, filename: "a.pdf", progress: { done: 1, total: 2 },
      cv: { name: "Ada", headline: "Eng", location: "SF", sections: [] },
      effective_location: "SF",
      page_url: `http://app.test/resumes/${ID}`,
    });
    expect(JSON.parse(text(r))).toEqual(r.structuredContent!);
  });

  test("cv stays null while parsing", async () => {
    const { deps } = setup(() => Response.json({ id: ID, status: "parsing", cv: null }));
    const r = await getResume(deps, { resume_id: ID });
    expect(r.structuredContent!.cv).toBeNull();
    expect(r.structuredContent!.effective_location).toBeNull();
  });

  test.each(["", "abc", ID.toUpperCase(), `${ID}/../x`, `${ID}0`])("rejects bad id %p without a call", async (bad) => {
    const { deps, calls } = setup();
    const r = await getResume(deps, { resume_id: bad });
    expect(r.isError).toBe(true);
    expect(text(r)).toBe("get_resume failed: resume_id must be 32 lowercase hex characters");
    expect(calls).toHaveLength(0);
  });

  test("uses FastAPI's detail string in errors", async () => {
    const { deps } = setup(() => Response.json({ detail: "Résumé not found." }, { status: 404 }));
    const r = await getResume(deps, { resume_id: ID });
    expect(r.isError).toBe(true);
    expect(text(r)).toBe("get_resume failed: 404 Résumé not found.");
  });

  test("joins validation messages, falls back to raw text, caps length", async () => {
    const v = setup(() => Response.json({ detail: [{ msg: "bad a" }, { msg: "bad b" }] }, { status: 422 }));
    expect(text(await getResume(v.deps, { resume_id: ID }))).toBe("get_resume failed: 422 bad a; bad b");
    const raw = setup(() => new Response("boom".repeat(200), { status: 500 }));
    const r = await getResume(raw.deps, { resume_id: ID });
    expect(text(r).length).toBe("get_resume failed: 500 ".length + 300);
  });

  test("network error, invalid JSON and bad shape do not throw", async () => {
    const down = setup(() => Promise.reject(new Error("ECONNREFUSED")));
    expect(text(await getResume(down.deps, { resume_id: ID }))).toBe("get_resume failed: ECONNREFUSED");
    const bad = setup(() => new Response("<html>"));
    expect((await getResume(bad.deps, { resume_id: ID })).isError).toBe(true);
    const arr = setup(() => Response.json([1]));
    expect(text(await getResume(arr.deps, { resume_id: ID }))).toStartWith("get_resume failed: unexpected response shape");
  });
});

describe("list_matches", () => {
  const item = {
    job_id: 5, job_key: "greenhouse:acme:1", title: "Eng", company: "Acme", locations: ["SF"],
    workplace_type: "remote", url: "https://jobs.example.com/1", salary_min: 1, salary_max: 2,
    salary_currency: "USD", salary_interval: "year", posted_at: "2026-10-01", score: 0.9, fit: 0.9,
    interview: 0.8, must_haves: 0.9, seniority: "matches", catalog_status: "open", model: "x",
  };

  test("sends defaults, trims items and nulls non-https urls", async () => {
    const { deps, calls } = setup(() =>
      Response.json({
        items: [item, { ...item, job_key: "k2", url: "http://insecure.example" }, { ...item, job_key: "k3", url: "javascript:alert(1)" }],
        total: 3, good_total: 3, other_total: 0, has_more: false, effective_location: "SF", offset: 0,
      }),
    );
    const r = await listMatches(deps, { resume_id: ID });
    expect(calls[0]!.url).toBe(`http://api/resumes/${ID}/match-results?category=good&nearby=false&limit=10&offset=0`);
    const out = r.structuredContent as { total: number; items: Record<string, unknown>[] };
    expect(out.total).toBe(3);
    expect(Object.keys(out)).not.toContain("offset");
    expect(out.items.map((i) => i.url)).toEqual(["https://jobs.example.com/1", null, null]);
    expect(out.items[0]).not.toHaveProperty("job_id");
    expect(out.items[0]).not.toHaveProperty("model");
    expect(out.items[0]!.job_key).toBe("greenhouse:acme:1");
  });

  test("passes explicit params; rejects out-of-range limit without a call", async () => {
    const { deps, calls } = setup(() => Response.json({ items: [] }));
    await listMatches(deps, { resume_id: ID, category: "all", nearby: true, limit: 25, offset: 5 });
    expect(calls[0]!.url).toContain("category=all&nearby=true&limit=25&offset=5");
    const r = await listMatches(deps, { resume_id: ID, limit: 26 });
    expect(r.isError).toBe(true);
    expect(calls).toHaveLength(1);
  });

  test("bad id is rejected", async () => {
    const { deps, calls } = setup();
    expect((await listMatches(deps, { resume_id: "nope" })).isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("search_jobs", () => {
  test("GETs /jobs with defaults and trims", async () => {
    const { deps, calls } = setup(() =>
      Response.json({
        synced: true, total: 1,
        jobs: [{ id: 1, provider: "lever", company: "Acme", title: "Eng", locations: "SF", workplace_type: "remote", posted_at: "d", url: "ftp://x", salary_min: 1, salary_max: 2, salary_currency: "USD", geo_bucket: "us_ca" }],
      }),
    );
    const r = await searchJobs(deps, { q: "python backend" });
    expect(calls[0]!.url).toBe("http://api/jobs?q=python+backend&geo=us_ca&limit=10");
    const job = (r.structuredContent as { jobs: Record<string, unknown>[] }).jobs[0]!;
    expect(job.url).toBeNull();
    expect(job).not.toHaveProperty("provider");
  });

  test("omits q when absent and rejects bad geo", async () => {
    const { deps, calls } = setup(() => Response.json({ synced: true, total: 0, jobs: [] }));
    await searchJobs(deps, {});
    expect(calls[0]!.url).toBe("http://api/jobs?geo=us_ca&limit=10");
    const r = await searchJobs(deps, { geo: "mars" as never });
    expect(r.isError).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

test("job_stats trims", async () => {
  const { deps, calls } = setup(() =>
    Response.json({ synced: true, open_jobs: 9, by_provider: { lever: 9 }, last_success_at: "t", sources: [1] }),
  );
  const r = await jobStats(deps);
  expect(calls[0]!.url).toBe("http://api/jobs/stats");
  expect(r.structuredContent).toEqual({ synced: true, open_jobs: 9, by_provider: { lever: 9 }, last_success_at: "t" });
});

describe("tailor_cv / get_tailored_cv", () => {
  const tailored = { id: "t1", status: "ready", error: null, download_url: `/resumes/${ID}/tailored/t1/cv.pdf`, design_source: "d" };

  test("tailor_cv POSTs job_key and returns an APP_ORIGIN download url", async () => {
    const { deps, calls } = setup(() => Response.json(tailored, { status: 202 }));
    const r = await tailorCv(deps, { resume_id: ID, job_key: "greenhouse:acme:1" });
    expect(calls[0]!.url).toBe(`http://api/resumes/${ID}/tailor`);
    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ job_key: "greenhouse:acme:1" });
    expect(r.structuredContent).toEqual({ id: "t1", status: "ready", error: null, download_url: `http://app.test/resumes/${ID}/tailored/t1/cv.pdf` });
  });

  test("download_url is null while pending or when not under /resumes/", async () => {
    const pending = setup(() => Response.json({ id: "t1", status: "queued", error: null, download_url: null }));
    expect((await getTailoredCv(pending.deps, { resume_id: ID, tailored_id: "t1" })).structuredContent!.download_url).toBeNull();
    const odd = setup(() => Response.json({ ...tailored, download_url: "https://evil.example/x.pdf" }));
    expect((await getTailoredCv(odd.deps, { resume_id: ID, tailored_id: "t1" })).structuredContent!.download_url).toBeNull();
  });

  test("get_tailored_cv encodes the tailored id in the path", async () => {
    const { deps, calls } = setup(() => Response.json(tailored));
    await getTailoredCv(deps, { resume_id: ID, tailored_id: "a/b?c" });
    expect(calls[0]!.url).toBe(`http://api/resumes/${ID}/tailored/a%2Fb%3Fc`);
  });

  test("a job that is not a match surfaces AviCV's detail", async () => {
    const { deps } = setup(() => Response.json({ detail: "This job isn't a saved match for the résumé." }, { status: 404 }));
    const r = await tailorCv(deps, { resume_id: ID, job_key: "x" });
    expect(text(r)).toBe("tailor_cv failed: 404 This job isn't a saved match for the résumé.");
  });

  test("bad id makes no call", async () => {
    const { deps, calls } = setup();
    expect((await tailorCv(deps, { resume_id: "x", job_key: "k" })).isError).toBe(true);
    expect((await getTailoredCv(deps, { resume_id: "x", tailored_id: "t" })).isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("rematch", () => {
  test("sends location when given, no body otherwise", async () => {
    const { deps, calls } = setup(() => Response.json({ id: ID }, { status: 202 }));
    const r = await rematch(deps, { resume_id: ID, location: "Toronto, ON" });
    expect(calls[0]!.url).toBe(`http://api/resumes/${ID}/rematch`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ location: "Toronto, ON" });
    expect(r.structuredContent).toEqual({ id: ID });
    await rematch(deps, { resume_id: ID });
    expect(calls[1]!.init.body).toBeUndefined();
  });

  test("bad id makes no call", async () => {
    const { deps, calls } = setup();
    expect((await rematch(deps, { resume_id: "x" })).isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

test("get_time_savings returns AviCV's body as is", async () => {
  const body = { jobs_reviewed: 6, cvs_tailored: 1, job_review_seconds: 30, cv_tailoring_seconds: 600, estimated_seconds: 780 };
  const { deps, calls } = setup(() => Response.json(body));
  const r = await getTimeSavings(deps, { resume_id: ID });
  expect(calls[0]!.url).toBe(`http://api/resumes/${ID}/time-savings`);
  expect(r.structuredContent).toEqual(body);
  expect((await getTimeSavings(deps, { resume_id: "bad" })).isError).toBe(true);
});
