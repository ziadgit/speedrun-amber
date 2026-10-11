import type { Config } from "../config";
import { createAvicvProxy } from "./avicv-proxy";

type Handler = (req: Request) => Response | Promise<Response>;

/** Serves the bundled chat page under /chat. Bundles on first request. */
export function createChatHandler(config: Config, fetchFn?: typeof fetch): Handler {
  const proxy = createAvicvProxy(config, fetchFn);
  const csp = `frame-ancestors ${config.appOrigin}`;
  const headers = { "Content-Security-Policy": csp };
  let assets: Promise<Map<string, Blob>> | undefined;

  const bundle = async () => {
    const result = await Bun.build({
      entrypoints: [new URL("./index.html", import.meta.url).pathname],
      publicPath: "/chat/",
      minify: true,
    });
    if (!result.success) throw new Error(`chat bundle failed: ${result.logs.join("\n")}`);
    const map = new Map<string, Blob>();
    for (const out of result.outputs) {
      const name = out.path.replace(/^\.\//, "");
      map.set(name === "index.html" ? "" : name, out);
    }
    return map;
  };

  return async (req) => {
    const { pathname } = new URL(req.url);
    const proxied = await proxy(req);
    if (proxied) return proxied;
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers });
    }
    if (pathname === "/chat/config.json") {
      return Response.json({ appOrigin: config.appOrigin }, { headers });
    }
    const rel = pathname === "/chat" || pathname === "/chat/" ? "" : pathname.replace(/^\/chat\//, "");
    try {
      const blob = await (assets ??= bundle()).then((m) => m.get(rel));
      if (blob) return new Response(blob, { headers: { ...headers, "Content-Type": blob.type } });
    } catch (err) {
      assets = undefined;
      return new Response(String(err), { status: 500, headers });
    }
    return new Response("not found", { status: 404, headers });
  };
}
