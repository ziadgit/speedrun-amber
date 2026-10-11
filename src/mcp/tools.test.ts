import { describe, expect, test } from "bun:test";
import { getProfile, logTimeSaved, saveJob, saveVariant } from "./tools";

interface Call { url: string; init: RequestInit }

function fakeFetch(respond: () => Response | Promise<Response>, calls: Call[] = []) {
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as unknown as typeof fetch;
  return { f, calls };
}

const profile = { name: "A", headline: "h", roles: [], projects: [], extra: 1 };
const variant = {
  id: "v1",
  job_id: "j1",
  bullets: [{ source_id: "r1", text: "did x" }],
  created_at: "2026-01-01T00:00:00Z",
};

describe("get_profile", () => {
  test("GETs /profile and passes through extra fields", async () => {
    const { f, calls } = fakeFetch(() => Response.json(profile));
    const r = await getProfile({ fetch: f, apiUrl: "http://api" });
    expect(calls[0]!.url).toBe("http://api/profile");
    expect(calls[0]!.init.method).toBe("GET");
    expect(r.isError).toBeUndefined();
    expect(r.structuredContent).toEqual(profile);
    expect(JSON.parse(r.content[0]!.text)).toEqual(profile);
  });

  test("non-2xx becomes an error result", async () => {
    const { f } = fakeFetch(() => new Response("boom".repeat(200), { status: 500 }));
    const r = await getProfile({ fetch: f, apiUrl: "http://api" });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text.startsWith("get_profile failed: 500 boom")).toBe(true);
    expect(r.content[0]!.text.length).toBe("get_profile failed: 500 ".length + 300);
  });

  test("network error and bad shape do not throw", async () => {
    const down = fakeFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    const r1 = await getProfile({ fetch: down.f, apiUrl: "http://api" });
    expect(r1.content[0]!.text).toBe("get_profile failed: ECONNREFUSED");
    const bad = fakeFetch(() => Response.json({ nope: true }));
    const r2 = await getProfile({ fetch: bad.f, apiUrl: "http://api" });
    expect(r2.isError).toBe(true);
  });
});

describe("save_variant", () => {
  const input = { job_id: "j1", bullets: [{ source_id: "r1", text: "did x" }] };

  test("POSTs /cv/variants with json body", async () => {
    const { f, calls } = fakeFetch(() => Response.json(variant));
    const r = await saveVariant({ fetch: f, apiUrl: "http://api" }, input);
    expect(calls[0]!.url).toBe("http://api/cv/variants");
    expect(calls[0]!.init.method).toBe("POST");
    expect(new Headers(calls[0]!.init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(input);
    expect(r.structuredContent).toEqual(variant);
  });

  test("404 reads job not found", async () => {
    const { f } = fakeFetch(() => new Response("x", { status: 404 }));
    const r = await saveVariant({ fetch: f, apiUrl: "http://api" }, input);
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe("save_variant failed: job j1 not found");
  });

  test("500 includes status", async () => {
    const { f } = fakeFetch(() => new Response("bad", { status: 500 }));
    const r = await saveVariant({ fetch: f, apiUrl: "http://api" }, input);
    expect(r.content[0]!.text).toBe("save_variant failed: 500 bad");
  });
});

describe("save_job", () => {
  const job = {
    id: "job-1", title: "BE", company: "Acme", description: "d", url: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  test("POSTs /jobs and omits url when absent", async () => {
    const { f, calls } = fakeFetch(() => Response.json(job));
    const r = await saveJob({ fetch: f, apiUrl: "http://api" }, { title: "BE", company: "Acme", description: "d" });
    expect(calls[0]!.url).toBe("http://api/jobs");
    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ title: "BE", company: "Acme", description: "d" });
    expect(r.structuredContent).toEqual(job);
  });

  test("sends url when given", async () => {
    const { f, calls } = fakeFetch(() => Response.json(job));
    await saveJob({ fetch: f, apiUrl: "http://api" }, { title: "BE", company: "Acme", description: "d", url: "https://x.io/1" });
    expect(JSON.parse(calls[0]!.init.body as string).url).toBe("https://x.io/1");
  });

  test("422 becomes an error result", async () => {
    const { f } = fakeFetch(() => new Response("bad body", { status: 422 }));
    const r = await saveJob({ fetch: f, apiUrl: "http://api" }, { title: "", company: "", description: "" });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe("save_job failed: 422 bad body");
  });
});

describe("log_time_saved", () => {
  const saved = { total_seconds_saved: 1790, entries: 1 };

  test("computes body from the injected clock and baseline", async () => {
    const { f, calls } = fakeFetch(() => Response.json(saved));
    const r = await logTimeSaved(
      { fetch: f, apiUrl: "http://api", now: () => 10_000 + 10_400, startedAt: 10_000 },
      { task: "tailor_cv" },
    );
    expect(calls[0]!.url).toBe("http://api/time-saved");
    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      task: "tailor_cv", seconds_taken: 10, baseline_seconds: 1800,
    });
    expect(r.structuredContent).toEqual(saved);
  });

  test("seconds_taken is at least 1 and find_jobs baseline is 1200", async () => {
    const { f, calls } = fakeFetch(() => Response.json(saved));
    await logTimeSaved({ fetch: f, apiUrl: "http://api", now: () => 5, startedAt: 5 }, { task: "find_jobs" });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      task: "find_jobs", seconds_taken: 1, baseline_seconds: 1200,
    });
  });

  test("failure is an error result", async () => {
    const { f } = fakeFetch(() => Promise.reject(new Error("down")));
    const r = await logTimeSaved({ fetch: f, apiUrl: "http://api", now: () => 0, startedAt: 0 }, { task: "find_jobs" });
    expect(r.content[0]!.text).toBe("log_time_saved failed: down");
  });
});
