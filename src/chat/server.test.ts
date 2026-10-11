import { afterAll, expect, test } from "bun:test";
import { loadConfig } from "../config";
import { createServer } from "../server";
import { createChatHandler } from "./server";

const config = loadConfig({ PORT: "0", APP_ORIGIN: "http://app.test:5173" });
const server = createServer(config, { chat: createChatHandler(config) });
const base = `http://127.0.0.1:${server.port}`;
afterAll(() => server.stop(true));

const csp = "frame-ancestors http://app.test:5173";

test("/chat serves html with frame-ancestors CSP", async () => {
  const res = await fetch(`${base}/chat`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(res.headers.get("content-security-policy")).toBe(csp);
  expect(res.headers.get("x-frame-options")).toBeNull();
  const html = await res.text();
  const script = html.match(/src="([^"]+\.js)"/)?.[1];
  expect(script).toBeDefined();

  const asset = await fetch(new URL(script!, `${base}/chat`));
  expect(asset.status).toBe(200);
  expect(asset.headers.get("content-security-policy")).toBe(csp);
}, 60_000);

test("/chat/config.json returns the app origin", async () => {
  const res = await fetch(`${base}/chat/config.json`);
  expect(await res.json()).toEqual({ appOrigin: "http://app.test:5173" });
  expect(res.headers.get("content-security-policy")).toBe(csp);
});

test("unknown /chat asset is 404 with CSP", async () => {
  const res = await fetch(`${base}/chat/nope.js`);
  expect(res.status).toBe(404);
  expect(res.headers.get("content-security-policy")).toBe(csp);
});
