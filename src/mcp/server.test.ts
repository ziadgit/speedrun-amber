import { afterAll, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadConfig } from "../config";
import { createServer } from "../server";
import { createMcpHandler } from "./server";

const calls: { url: string; method: string }[] = [];
const fakeFetch = (async (url: string, init?: RequestInit) => {
  calls.push({ url, method: init?.method ?? "GET" });
  return Response.json({ name: "Ada", headline: "Eng", roles: [], projects: [] });
}) as unknown as typeof fetch;

const config = loadConfig({ PORT: "0", API_URL: "http://api.test" });
const server = createServer(config, { mcp: createMcpHandler(config, { fetch: fakeFetch }) });
afterAll(() => server.stop(true));

async function connect() {
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)));
  return client;
}

test("lists exactly the five cv-tools", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual(["get_profile", "log_time_saved", "save_job", "save_variant", "search_jobs"]);
  expect(client.getServerVersion()?.name).toBe("cv-tools");
  await client.close();
});

test("calling a tool hits the API through the injected fetch", async () => {
  const client = await connect();
  const res = await client.callTool({ name: "get_profile", arguments: {} });
  expect(res.isError).toBeFalsy();
  expect(calls.at(-1)).toEqual({ url: "http://api.test/profile", method: "GET" });
  expect((res.structuredContent as { name: string }).name).toBe("Ada");
  await client.close();
});

test("invalid input is rejected without calling the API", async () => {
  const client = await connect();
  const before = calls.length;
  const res = await client.callTool({ name: "save_variant", arguments: { job_id: "j1", bullets: [] } }).catch(() => ({ isError: true }));
  expect(res.isError).toBe(true);
  expect(calls.length).toBe(before);
  await client.close();
});

test("log_time_saved measures from the first call of each task, not server start", async () => {
  const bodies: { seconds_taken: number }[] = [];
  const timeFetch = (async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/time-saved")) bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ name: "Ada", headline: "Eng", roles: [], projects: [], id: "t1", seconds_saved: 1 });
  }) as unknown as typeof fetch;
  let t = 0;
  const cfg = loadConfig({ PORT: "0", API_URL: "http://api.test" });
  const srv = createServer(cfg, { mcp: createMcpHandler(cfg, { fetch: timeFetch, now: () => t }) });
  try {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${srv.port}/mcp`)));
    const log = () => client.callTool({ name: "log_time_saved", arguments: { task: "find_jobs" } });
    await client.callTool({ name: "get_profile", arguments: {} });
    t = 60_000;
    await log();
    t = 3_600_000;
    await client.callTool({ name: "get_profile", arguments: {} });
    t = 3_630_000;
    await log();
    expect(bodies.map((b) => b.seconds_taken)).toEqual([60, 30]);
    await client.close();
  } finally {
    srv.stop(true);
  }
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
