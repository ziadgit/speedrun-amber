import { loadConfig, type Config } from "./config";

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
  const server = createServer(config);
  console.log(`chat:    ${server.url}chat`);
  console.log(`mcp:     ${server.url}mcp`);
  console.log(`copilot: ${server.url}api/copilotkit`);
}
