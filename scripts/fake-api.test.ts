import { afterAll, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadConfig } from "../src/config";
import { createMcpHandler } from "../src/mcp/server";
import { createServer } from "../src/server";
import { createFakeApi } from "./fake-api";

const log = console.log;
console.log = () => {};
const api = createFakeApi(0);
afterAll(() => {
  console.log = log;
  api.stop(true);
});
const base = `http://127.0.0.1:${api.port}`;
const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("health and seeded profile", async () => {
  expect((await fetch(`${base}/health`)).status).toBe(200);
  const p = await (await fetch(`${base}/profile`)).json();
  expect(p.roles[0].id).toBe("role-1");
  expect(p.projects[0].id).toBe("proj-1");
});

test("bad bodies are 422, unknown job is 404", async () => {
  expect((await post("/jobs", { title: "x" })).status).toBe(422);
  expect((await post("/cv/variants", { job_id: "job-99", bullets: [{ source_id: "role-1", text: "t" }] })).status).toBe(404);
  expect((await post("/cv/variants", { job_id: "job-1", bullets: [] })).status).toBe(422);
  expect((await post("/time-saved", {})).status).toBe(422);
});

test("time-saved floors at zero and accumulates", async () => {
  await post("/time-saved", { task: "find_jobs", seconds_taken: 200, baseline_seconds: 1200 });
  const r = await (await post("/time-saved", { task: "x", seconds_taken: 500, baseline_seconds: 100 })).json();
  expect(r).toEqual({ total_seconds_saved: 1000, entries: 2 });
});

test("round trip: MCP client -> /mcp -> fake API", async () => {
  const config = loadConfig({ PORT: "0", API_URL: base });
  const server = createServer(config, { mcp: createMcpHandler(config) });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)));
  try {
    const job = await client.callTool({
      name: "save_job",
      arguments: { title: "Backend", company: "Acme", description: "d" },
    });
    const jobId = (job.structuredContent as { id: string }).id;
    expect(jobId).toMatch(/^job-/);
    const variant = await client.callTool({
      name: "save_variant",
      arguments: { job_id: jobId, bullets: [{ source_id: "role-1", text: "Built a ledger" }] },
    });
    expect(variant.isError).toBeFalsy();
    expect((variant.structuredContent as { job_id: string }).job_id).toBe(jobId);
  } finally {
    await client.close();
    server.stop(true);
  }
});

test("PUT /profile validates, stores and returns; empty start is 404 until a PUT", async () => {
  const empty = createFakeApi(0, { emptyProfile: true });
  const eb = `http://127.0.0.1:${empty.port}`;
  const config = loadConfig({ PORT: "0", API_URL: eb });
  const server = createServer(config, { mcp: createMcpHandler(config) });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)));
  try {
    const put = (body: unknown) =>
      fetch(`${eb}/profile`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await put({ name: "x" })).status).toBe(422);
    const before = await client.callTool({ name: "get_profile", arguments: {} });
    expect(before.isError).toBe(true);
    expect((before.content as { text: string }[])[0]!.text).toBe(
      "get_profile failed: no profile yet; ask the user to upload their CV",
    );
    const cv = {
      name: "Grace",
      headline: "Compiler engineer",
      roles: [{ id: "role-1", title: "Eng", company: "Navy", start: "1944-01-01", end: null, bullets: ["Wrote A-0"] }],
      projects: [],
    };
    const saved = await client.callTool({ name: "save_profile", arguments: cv });
    expect(saved.isError).toBeFalsy();
    const after = await client.callTool({ name: "get_profile", arguments: {} });
    expect(after.structuredContent).toEqual(cv);
  } finally {
    await client.close();
    server.stop(true);
    empty.stop(true);
  }
});
