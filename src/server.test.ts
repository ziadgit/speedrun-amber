import { afterAll, expect, test } from "bun:test";
import { loadConfig } from "./config";
import { createServer } from "./server";

const server = createServer(loadConfig({ PORT: "0" }), { mcp: () => new Response("mcp") });
const base = `http://127.0.0.1:${server.port}`;
afterAll(() => server.stop(true));

test("health", async () => {
  const res = await fetch(`${base}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("unknown path is 404", async () => {
  expect((await fetch(`${base}/nope`)).status).toBe(404);
});

test("unmounted group is 404, mounted group dispatches", async () => {
  expect((await fetch(`${base}/chat`)).status).toBe(404);
  expect(await (await fetch(`${base}/mcp`)).text()).toBe("mcp");
});

test("/mcp rejects non-loopback clients before the handler runs", async () => {
  let called = false;
  const remote = createServer(loadConfig({ PORT: "0" }), {
    mcp: () => ((called = true), new Response("mcp")),
    clientIp: () => "203.0.113.9",
  });
  try {
    const res = await fetch(`http://127.0.0.1:${remote.port}/mcp`);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(called).toBe(false);
  } finally {
    remote.stop(true);
  }
});

test("/mcp rejects an unknown client address", async () => {
  const unknown = createServer(loadConfig({ PORT: "0" }), {
    mcp: () => new Response("mcp"),
    clientIp: () => undefined,
  });
  try {
    expect((await fetch(`http://127.0.0.1:${unknown.port}/mcp`)).status).toBe(403);
  } finally {
    unknown.stop(true);
  }
});
