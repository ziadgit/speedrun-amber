import { createAnthropic } from "@ai-sdk/anthropic";
import {
  BuiltInAgent,
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import type { Config } from "./config";
import { createDarwinProvider } from "./darwin";
import { AGENT_INSTRUCTIONS } from "./instructions";

/** A plain `MODEL` string, or an Anthropic model carrying the workspace header when one is configured. */
export function agentModel(config: Config, fetchImpl?: typeof fetch) {
  const model = config.model!;
  const id = config.anthropicWorkspaceId;
  const sep = model.search(/[:/]/);
  if (!id || sep < 0 || model.slice(0, sep).toLowerCase() !== "anthropic") return model;
  return createAnthropic({ headers: { "anthropic-workspace-id": id }, fetch: fetchImpl })(model.slice(sep + 1));
}

/** `port` is the port the server really bound (matters when PORT=0). */
export function createCopilotHandler(config: Config, port: number = config.port) {
  if (!config.model) throw new Error("MODEL is required to start the agent (e.g. MODEL=anthropic:claude-sonnet-5-5)");
  // One instance runs one run at a time; fine for a single-user demo.
  const agent = new BuiltInAgent({
    model: agentModel(config),
    prompt: AGENT_INSTRUCTIONS,
    mcpClients: [createDarwinProvider(config.darwinMcpUrl)],
    mcpServers: [{ type: "http", name: "cv", url: `http://127.0.0.1:${port}/mcp` }],
  });
  const runtime = new CopilotRuntime({ agents: { default: agent }, runner: new InMemoryAgentRunner() });
  return createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });
}
