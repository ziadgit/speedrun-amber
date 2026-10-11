import { afterAll, expect, test } from "bun:test";
import { loadConfig } from "./config";
import { createCopilotHandler } from "./runtime";
import { createServer } from "./server";

test("throws a clear error when MODEL is unset", () => {
  expect(() => createCopilotHandler(loadConfig({ PORT: "0" }))).toThrow(/MODEL/);
});

const config = loadConfig({ PORT: "0", MODEL: "openai/gpt-4o-mini" });
const server = createServer(config, { copilot: createCopilotHandler(config, 4000) });
afterAll(() => server.stop(true));

test("mounted handler answers /info without running a model", async () => {
  const res = await fetch(`http://127.0.0.1:${server.port}/api/copilotkit/info`);
  expect(res.ok).toBe(true);
  const body = (await res.json()) as { agents: Record<string, unknown> };
  expect(Object.keys(body.agents)).toEqual(["default"]);
});
