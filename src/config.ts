export interface Config {
  apiUrl: string;
  model: string | undefined;
  darwinMcpUrl: string;
  appOrigin: string;
  port: number;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  const apiUrl = (env.API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  return {
    apiUrl,
    model: env.MODEL || undefined,
    darwinMcpUrl: env.DARWIN_MCP_URL || "https://mcp.darwin.so/mcp",
    appOrigin: parseOrigin(env.APP_ORIGIN || "http://localhost:5173"),
    port: parsePort(env.PORT ?? "4000"),
  };
}

function parseOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`APP_ORIGIN must be a URL origin, got "${value}"`);
  }
  if (url.origin === "null" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password) {
    throw new Error(`APP_ORIGIN must be a bare origin (no path), got "${value}"`);
  }
  return url.origin;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || port > 65535) {
    throw new Error(`PORT must be an integer 0-65535, got "${value}"`);
  }
  return port;
}
