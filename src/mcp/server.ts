import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import pkg from "../../package.json";
import type { Config } from "../config";
import type { Handler } from "../server";
import { TOOLS, type ToolDeps } from "./tools";

export interface McpDeps extends Partial<ToolDeps> {
  now?: () => number;
}

/**
 * Stateless Streamable HTTP handler: a fresh McpServer and transport per
 * request. The task start for log_time_saved is the first tool call since server start or the previous log_time_saved.
 */
export function createMcpHandler(config: Pick<Config, "apiUrl">, deps: McpDeps = {}): Handler {
  const fetchFn = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  let startedAt: number | undefined;

  const build = () => {
    const server = new McpServer({ name: "cv-tools", version: pkg.version });
    for (const tool of TOOLS) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputShape },
        async (input: unknown) => {
          startedAt ??= now();
          const deps = { fetch: fetchFn, apiUrl: config.apiUrl, now, startedAt };
          // Success or failure, logging ends the task; the next call starts a new one.
          if (tool.name === "log_time_saved") startedAt = undefined;
          return tool.run(deps, input);
        },
      );
    }
    return server;
  };

  return async (req) => {
    const server = build();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(req);
  };
}
