import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import pkg from "../../package.json";
import type { Config } from "../config";
import type { Handler } from "../server";
import { TOOLS } from "./tools";

export interface McpDeps {
  fetch?: typeof fetch;
}

/** Stateless Streamable HTTP handler: a fresh McpServer and transport per request. */
export function createMcpHandler(config: Pick<Config, "apiUrl" | "appOrigin">, deps: McpDeps = {}): Handler {
  const toolDeps = { fetch: deps.fetch ?? fetch, apiUrl: config.apiUrl, appOrigin: config.appOrigin };

  const build = () => {
    const server = new McpServer({ name: "cv-tools", version: pkg.version });
    for (const tool of TOOLS) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputShape },
        async (input: unknown) => tool.run(toolDeps, input),
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
