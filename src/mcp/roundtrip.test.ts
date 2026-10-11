import { afterAll, expect, test } from "bun:test";
import { createFakeApi } from "../../scripts/fake-api";
import { getResume, getTailoredCv, getTimeSavings, listMatches, tailorCv, type ToolDeps, type ToolResult } from "./tools";

const log = console.log;
console.log = () => {};
const api = createFakeApi(0);
afterAll(() => {
  console.log = log;
  api.stop(true);
});

const apiUrl = `http://127.0.0.1:${api.port}`;
const deps: ToolDeps = { fetch, apiUrl, appOrigin: "https://avicv.test" };
const data = (r: ToolResult) => {
  expect(r.isError).toBeUndefined();
  return r.structuredContent as Record<string, any>;
};

test("upload → get_resume → list_matches → tailor_cv → get_tailored_cv → get_time_savings", async () => {
  // Upload is not a tool: the chat page's proxy does it, so the test posts to the fake API directly.
  const form = new FormData();
  form.set("file", new File(["%PDF-1.4\n"], "cv.pdf", { type: "application/pdf" }));
  const up = await fetch(`${apiUrl}/resumes`, { method: "POST", body: form });
  expect(up.status).toBe(202);
  const { id } = (await up.json()) as { id: string };

  let resume = data(await getResume(deps, { resume_id: id }));
  for (let i = 0; i < 10 && resume.status !== "done"; i++) resume = data(await getResume(deps, { resume_id: id }));
  expect(resume.status).toBe("done");
  expect(resume.cv.name).toBe("Ada Example");
  expect(resume.page_url).toBe(`https://avicv.test/resumes/${id}`);

  const matches = data(await listMatches(deps, { resume_id: id, category: "good", limit: 5 }));
  expect(matches.items.length).toBeGreaterThan(0);
  const top = matches.items[0];
  expect(typeof top.job_key).toBe("string");

  const started = data(await tailorCv(deps, { resume_id: id, job_key: top.job_key }));
  expect(started.status).toBe("queued");
  expect(started.download_url).toBeNull();

  let tailored = data(await getTailoredCv(deps, { resume_id: id, tailored_id: started.id }));
  for (let i = 0; i < 10 && tailored.status !== "ready"; i++) {
    tailored = data(await getTailoredCv(deps, { resume_id: id, tailored_id: started.id }));
  }
  expect(tailored.status).toBe("ready");
  expect(tailored.download_url).toBe(`https://avicv.test/resumes/${id}/tailored/${started.id}/cv.pdf`);

  const savings = data(await getTimeSavings(deps, { resume_id: id }));
  expect(savings.cvs_tailored).toBe(1);
  expect(savings.estimated_seconds).toBeGreaterThan(0);
});
