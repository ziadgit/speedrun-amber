import { afterAll, expect, test } from "bun:test";
import { loadConfig } from "./config";
import { agentModel, createCopilotHandler } from "./runtime";
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

test("agentModel sends anthropic-workspace-id when configured", async () => {
  let headers: Headers | undefined;
  const fake = (async (_url: unknown, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    return new Response("{}", { status: 400 });
  }) as unknown as typeof fetch;
  const model = agentModel(
    loadConfig({ MODEL: "Anthropic:claude-sonnet-5-5", ANTHROPIC_WORKSPACE_ID: "wrkspc_1" }),
    fake,
  );
  expect(typeof model).toBe("object");
  await (model as any).doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }).catch(() => {});
  expect(headers?.get("anthropic-workspace-id")).toBe("wrkspc_1");
});

test("agentModel passes MODEL through unchanged without the variable or for other providers", () => {
  expect(agentModel(loadConfig({ MODEL: "anthropic:claude-sonnet-5-5" }))).toBe("anthropic:claude-sonnet-5-5");
  expect(agentModel(loadConfig({ MODEL: "openai/gpt-4o", ANTHROPIC_WORKSPACE_ID: "w" }))).toBe("openai/gpt-4o");
});
