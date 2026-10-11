import {
  BuiltInAgent,
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import type { Config } from "./config";
import { AGENT_INSTRUCTIONS } from "./instructions";

/** `port` is the port the server really bound (matters when PORT=0). */
export function createCopilotHandler(config: Config, port: number = config.port) {
  if (!config.model) throw new Error("MODEL is required to start the agent (e.g. MODEL=openai/gpt-4o-mini)");
  // One instance runs one run at a time; fine for a single-user demo.
  const agent = new BuiltInAgent({
    model: config.model,
    prompt: AGENT_INSTRUCTIONS,
    mcpServers: [
      { type: "http", name: "darwin", url: config.darwinMcpUrl },
      { type: "http", name: "cv", url: `http://127.0.0.1:${port}/mcp` },
    ],
  });
  const runtime = new CopilotRuntime({ agents: { default: agent }, runner: new InMemoryAgentRunner() });
  return createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });
}
