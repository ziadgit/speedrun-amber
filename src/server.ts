import { loadConfig, type Config } from "./config";
import { createMcpHandler } from "./mcp/server";
import { createCopilotHandler } from "./runtime";

export type Handler = (req: Request) => Response | Promise<Response>;

export interface ServerDeps {
  copilot?: Handler;
  mcp?: Handler;
  chat?: Handler;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

export function createServer(config: Config, deps: ServerDeps = {}) {
  return Bun.serve({
    port: config.port,
    fetch(req) {
      const { pathname } = new URL(req.url);
      const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (pathname === "/health" && req.method === "GET") return json({ status: "ok" });
      if (under("/api/copilotkit") && deps.copilot) return deps.copilot(req);
      if (under("/mcp") && deps.mcp) return deps.mcp(req);
      if (under("/chat") && deps.chat) return deps.chat(req);
      return json({ error: "not found" }, 404);
    },
  });
}

if (import.meta.main) {
  const config = loadConfig();
  // The agent needs the bound port for its cv MCP URL, so build it on first request.
  let copilot: Handler | undefined;
  const server: ReturnType<typeof createServer> = createServer(config, {
    mcp: createMcpHandler(config),
    copilot: (req) => (copilot ??= createCopilotHandler(config, server.port))(req),
  });
  console.log(`chat:    ${server.url}chat`);
  console.log(`mcp:     ${server.url}mcp`);
  console.log(`copilot: ${server.url}api/copilotkit`);
}
