import { afterAll, expect, test } from "bun:test";
import { loadConfig } from "../config";
import { createServer } from "../server";
import { createChatHandler } from "./server";

const config = loadConfig({ PORT: "0", API_URL: "http://api.test", APP_ORIGIN: "http://app.test:5173" });
const calls: { url: string; method: string; type: string | null; size: number }[] = [];
const fakeFetch = (async (url: string, init?: RequestInit) => {
  const body = init?.body as ArrayBuffer | undefined;
  const headers = new Headers(init?.headers);
  calls.push({ url, method: init?.method ?? "GET", type: headers.get("content-type"), size: body?.byteLength ?? 0 });
  if (url.includes("boom")) throw new Error("down");
  if (url.endsWith("/resumes") && init?.method === "POST") {
    return Response.json({ detail: "not a pdf" }, { status: 415 });
  }
  return Response.json({ ok: true, url });
}) as unknown as typeof fetch;

const server = createServer(config, { chat: createChatHandler(config, fakeFetch) });
const base = `http://127.0.0.1:${server.port}/chat/avicv`;
afterAll(() => server.stop(true));

const id = "0".repeat(31) + "1";
const csp = "frame-ancestors http://app.test:5173";

test("allowed GET routes pass through with CSP and no-store", async () => {
  for (const [path, upstream] of [
    ["stats", "/jobs/stats"],
    [`resumes/${id}`, `/resumes/${id}`],
    [`resumes/${id}/time-savings`, `/resumes/${id}/time-savings`],
  ]) {
    const res = await fetch(`${base}/${path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(csp);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect((await res.json()).url).toBe(`http://api.test${upstream}`);
  }
});

test("POST resumes forwards the body and content type, and relays the status", async () => {
  calls.length = 0;
  const form = new FormData();
  form.append("file", new Blob(["hello"], { type: "text/plain" }), "cv.txt");
  const res = await fetch(`${base}/resumes`, { method: "POST", body: form });
  expect(res.status).toBe(415);
  expect(await res.json()).toEqual({ detail: "not a pdf" });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe("http://api.test/resumes");
  expect(calls[0]!.type).toStartWith("multipart/form-data; boundary=");
  expect(calls[0]!.size).toBeGreaterThan(5);
});

test("other paths and methods are 404 with CSP and no upstream call", async () => {
  calls.length = 0;
  const cases: [string, string][] = [
    ["GET", "resumes"],
    ["GET", `resumes/${id}/tailored/abc`],
    ["GET", `resumes/${id}/match-results`],
    ["GET", "jobs"],
    ["POST", "stats"],
    ["DELETE", `resumes/${id}`],
    ["POST", `resumes/${id}/rematch`],
  ];
  for (const [method, path] of cases) {
    const res = await fetch(`${base}/${path}`, { method });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-security-policy")).toBe(csp);
  }
  expect(calls).toHaveLength(0);
});

test("a bad resume id is 400 with no upstream call", async () => {
  calls.length = 0;
  for (const bad of ["abc", "..%2Fjobs", "A".repeat(32), "0".repeat(33)]) {
    expect((await fetch(`${base}/resumes/${bad}`)).status).toBe(400);
    expect((await fetch(`${base}/resumes/${bad}/time-savings`)).status).toBe(400);
  }
  expect(calls).toHaveLength(0);
});

test("an oversized upload is 413 without an upstream call", async () => {
  calls.length = 0;
  const res = await fetch(`${base}/resumes`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(11 * 1024 * 1024 + 1),
  });
  expect(res.status).toBe(413);
  expect(calls).toHaveLength(0);
});

test("an unreachable AviCV is 502", async () => {
  const dead = createChatHandler(config, (async () => {
    throw new Error("refused");
  }) as unknown as typeof fetch);
  const res = await dead(new Request(`http://x/chat/avicv/stats`));
  expect(res.status).toBe(502);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
});
