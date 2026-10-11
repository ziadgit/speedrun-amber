import { afterAll, expect, test } from "bun:test";
import { createFakeApi, SEEDED_RESUME_ID } from "./fake-api";

const log = console.log;
console.log = () => {};
const api = createFakeApi(0);
afterAll(() => {
  console.log = log;
  api.stop(true);
});
const base = `http://127.0.0.1:${api.port}`;
const get = async (path: string) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json().catch(() => undefined) };
};
const post = async (path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => undefined) };
};
const upload = async (content: BlobPart, name = "cv.pdf") => {
  const form = new FormData();
  form.set("file", new File([content], name, { type: "application/pdf" }));
  const res = await fetch(`${base}/resumes`, { method: "POST", body: form });
  return { status: res.status, body: await res.json().catch(() => undefined) };
};

test("health, stats and substring job search", async () => {
  expect((await get("/health")).status).toBe(200);
  const stats = (await get("/jobs/stats")).body;
  expect(stats.open_jobs).toBe(20);
  expect(Object.values(stats.by_provider).reduce((a, b) => (a as number) + (b as number), 0)).toBe(20);
  const hits = (await get("/jobs?q=backend&limit=2")).body;
  expect(hits.synced).toBe(true);
  expect(hits.total).toBe(4);
  expect(hits.jobs).toHaveLength(2);
  expect(hits.jobs[0].locations).toBeString();
  expect((await get("/jobs?q=zzzz")).body.total).toBe(0);
});

test("seeded résumé is done with six matches, three good", async () => {
  const resume = (await get(`/resumes/${SEEDED_RESUME_ID}`)).body;
  expect(resume.status).toBe("done");
  expect(resume.cv.name).toBe("Ada Example");
  expect(resume.progress).toMatchObject({ done: 6, total: 6 });
  const all = (await get(`/resumes/${SEEDED_RESUME_ID}/match-results`)).body;
  expect(all.total).toBe(6);
  expect(all.good_total).toBe(3);
  const good = (await get(`/resumes/${SEEDED_RESUME_ID}/match-results?category=good&limit=2`)).body;
  expect(good.total).toBe(3);
  expect(good.items).toHaveLength(2);
  expect(good.has_more).toBe(true);
  expect(good.items[0].score).toBeGreaterThan(0.8);
  const other = (await get(`/resumes/${SEEDED_RESUME_ID}/match-results?category=other&offset=1`)).body;
  expect(other.items).toHaveLength(2);
  expect(other.has_more).toBe(false);
});

test("unknown résumé is 404 with a detail", async () => {
  const res = await get("/resumes/ffffffffffffffffffffffffffffffff");
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ detail: "Résumé not found." });
});

test("upload checks the PDF magic and advances one step per GET", async () => {
  expect((await upload("hello")).status).toBe(415);
  expect((await upload(new Uint8Array(10 * 1024 * 1024 + 1).fill(37))).status).toBe(413);
  const created = await upload("%PDF-1.4 fake", "me.pdf");
  expect(created.status).toBe(202);
  expect(created.body.id).toMatch(/^[0-9a-f]{32}$/);
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) seen.push((await get(`/resumes/${created.body.id}`)).body.status);
  expect(seen).toEqual(["queued", "parsing", "matching", "done", "done"]);
  expect((await get(`/resumes/${created.body.id}`)).body.filename).toBe("me.pdf");
});

test("tailoring: 404 for a non-match, queued → tailoring → ready, PDF only when ready", async () => {
  const keys = (await get(`/resumes/${SEEDED_RESUME_ID}/match-results`)).body.items.map((m: { job_key: string }) => m.job_key);
  const missing = await post(`/resumes/${SEEDED_RESUME_ID}/tailor`, { job_key: "greenhouse:nope:1" });
  expect(missing).toEqual({ status: 404, body: { detail: "This job isn't a saved match for the résumé." } });
  expect((await post(`/resumes/${SEEDED_RESUME_ID}/tailor`, {})).status).toBe(422);

  const started = await post(`/resumes/${SEEDED_RESUME_ID}/tailor`, { job_key: keys[0] });
  expect(started.status).toBe(202);
  expect(started.body).toMatchObject({ status: "queued", download_url: null });
  const id = started.body.id;
  const path = `/resumes/${SEEDED_RESUME_ID}/tailored/${id}`;
  expect((await fetch(base + path + "/cv.pdf")).status).toBe(409);
  expect((await get(path)).body.status).toBe("queued");
  expect((await get(path)).body.status).toBe("tailoring");
  const ready = (await get(path)).body;
  expect(ready.status).toBe("ready");
  expect(ready.download_url).toBe(`${path}/cv.pdf`);
  const pdf = await fetch(base + ready.download_url);
  expect(pdf.headers.get("content-type")).toBe("application/pdf");
  expect((await pdf.text()).startsWith("%PDF-")).toBe(true);
  expect((await get(`/resumes/${SEEDED_RESUME_ID}/tailored/nope`)).body).toEqual({ detail: "Tailored CV not found." });
});

test("time savings counts matches and ready tailored CVs", async () => {
  const created = await upload("%PDF-1.4", "t.pdf");
  const fresh = `/resumes/${created.body.id}/time-savings`;
  expect((await get(fresh)).body).toMatchObject({ jobs_reviewed: 0, cvs_tailored: 0, estimated_seconds: 0 });
  const seeded = (await get(`/resumes/${SEEDED_RESUME_ID}/time-savings`)).body;
  expect(seeded.jobs_reviewed).toBe(6);
  expect(seeded.estimated_seconds).toBe(6 * 30 + seeded.cvs_tailored * 600);
});

test("rematch: optional location, 409 while parsing, 422 on an empty location", async () => {
  const created = await upload("%PDF-1.4", "r.pdf");
  expect((await post(`/resumes/${created.body.id}/rematch`)).status).toBe(409);
  expect((await post(`/resumes/${SEEDED_RESUME_ID}/rematch`, { location: "" })).status).toBe(422);
  const ok = await post(`/resumes/${SEEDED_RESUME_ID}/rematch`, { location: "Berlin" });
  expect(ok).toEqual({ status: 202, body: { id: SEEDED_RESUME_ID } });
  const during = (await get(`/resumes/${SEEDED_RESUME_ID}`)).body;
  expect(during.status).toBe("queued");
  expect(during.effective_location).toBeNull();
  for (let i = 0; i < 3; i++) await get(`/resumes/${SEEDED_RESUME_ID}`);
  const after = (await get(`/resumes/${SEEDED_RESUME_ID}`)).body;
  expect(after.status).toBe("done");
  expect(after.effective_location).toBe("Berlin");
  expect((await post(`/resumes/${SEEDED_RESUME_ID}/rematch`)).status).toBe(202);
});
