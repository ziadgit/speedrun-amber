// Live probe (network). Fetches one known board per provider and prints the
// top-level keys of the response and of one job. Never imported by src/ or tests.
const BOARDS: { board: string; company: string; url: string }[] = [
  { board: "greenhouse", company: "stripe", url: "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true" },
  { board: "lever", company: "palantir", url: "https://api.lever.co/v0/postings/palantir?mode=json" },
  { board: "ashby", company: "ramp", url: "https://api.ashbyhq.com/posting-api/job-board/ramp" },
];

for (const { board, company, url } of BOARDS) {
  console.log(`\n== ${board} (${company}) ${url}`);
  try {
    const res = await fetch(url);
    console.log("status", res.status);
    const body: unknown = await res.json();
    const list: unknown = Array.isArray(body) ? body : (body as { jobs?: unknown }).jobs;
    console.log("top-level:", Array.isArray(body) ? `array(${body.length})` : Object.keys(body as object));
    const first = Array.isArray(list) ? list[0] : undefined;
    if (first && typeof first === "object") {
      const j = first as Record<string, unknown>;
      console.log("job keys:", Object.keys(j));
      for (const k of ["title", "text", "location", "locationName", "categories", "absolute_url", "hostedUrl", "jobUrl", "applyUrl"]) {
        if (k in j) console.log(`  ${k}:`, JSON.stringify(j[k]).slice(0, 120));
      }
      for (const k of ["content", "description", "descriptionPlain", "descriptionHtml", "descriptionBody"]) {
        if (k in j) console.log(`  ${k}: ${typeof j[k]} len=${String(j[k]).length}`);
      }
    }
  } catch (e) {
    console.log("error:", e instanceof Error ? e.message : e);
  }
}
export {};
