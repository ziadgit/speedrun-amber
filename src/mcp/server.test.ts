import { afterAll, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadConfig } from "../config";
import { createServer } from "../server";
import { createMcpHandler } from "./server";

const ID = "0123456789abcdef0123456789abcdef";
const calls: { url: string; method: string }[] = [];
const fakeFetch = (async (url: string, init?: RequestInit) => {
  calls.push({ url, method: init?.method ?? "GET" });
  return Response.json({ id: ID, status: "done", cv: null });
}) as unknown as typeof fetch;

const config = loadConfig({ PORT: "0", API_URL: "http://api.test", APP_ORIGIN: "http://app.test" });
const server = createServer(config, { mcp: createMcpHandler(config, { fetch: fakeFetch }) });
afterAll(() => server.stop(true));

async function connect() {
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)));
  return client;
}

test("lists exactly the eight cv-tools", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual([
    "get_resume", "get_tailored_cv", "get_time_savings", "job_stats", "list_matches", "rematch", "search_jobs", "tailor_cv",
  ]);
  expect(client.getServerVersion()?.name).toBe("cv-tools");
  await client.close();
});

test("calling a tool hits the API through the injected fetch", async () => {
  const client = await connect();
  const res = await client.callTool({ name: "get_resume", arguments: { resume_id: ID } });
  expect(res.isError).toBeFalsy();
  expect(calls.at(-1)).toEqual({ url: `http://api.test/resumes/${ID}`, method: "GET" });
  expect((res.structuredContent as { page_url: string }).page_url).toBe(`http://app.test/resumes/${ID}`);
  await client.close();
});

test("invalid input is rejected without calling the API", async () => {
  const client = await connect();
  const before = calls.length;
  const res = await client.callTool({ name: "list_matches", arguments: { resume_id: ID, limit: 99 } }).catch(() => ({ isError: true }));
  expect(res.isError).toBe(true);
  const bad = await client.callTool({ name: "get_resume", arguments: { resume_id: "nope" } });
  expect(bad.isError).toBe(true);
  expect(calls.length).toBe(before);
  await client.close();
});

test("every cv-tool inputSchema is a plain object with no top-level union", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  for (const t of tools) {
    const schema = t.inputSchema as Record<string, unknown>;
    expect(schema.type).toBe("object");
    for (const key of ["oneOf", "anyOf", "allOf"]) expect(schema[key]).toBeUndefined();
  }
  await client.close();
});
