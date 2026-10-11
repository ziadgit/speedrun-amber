import type { Config } from "../config";

const PREFIX = "/chat/avicv/";
const RESUME_ID = /^[0-9a-f]{32}$/;
/** AviCV's upload limit is 10 MB; leave room for multipart framing. */
const MAX_UPLOAD_BYTES = 11 * 1024 * 1024;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Same-origin pass-through to AviCV's FastAPI for the chat page (spec 08
 * "Proxy routes"). Returns undefined when the path is not under /chat/avicv/.
 */
export function createAvicvProxy(config: Config, fetchFn: Fetch = fetch) {
  const base = {
    "Content-Security-Policy": `frame-ancestors ${config.appOrigin}`,
    "Cache-Control": "private, no-store",
  };
  const fail = (status: number, error: string) => Response.json({ error }, { status, headers: base });

  /** The upstream path for an allowed request, or a failure response. */
  const route = (method: string, rest: string): string | Response => {
    const parts = rest.split("/");
    if (method === "POST" && rest === "resumes") return "/resumes";
    if (method !== "GET") return fail(404, "not found");
    if (rest === "stats") return "/jobs/stats";
    const [head, id, tail, extra] = parts;
    if (head !== "resumes" || !id || extra !== undefined) return fail(404, "not found");
    if (tail !== undefined && tail !== "time-savings") return fail(404, "not found");
    if (!RESUME_ID.test(id)) return fail(400, "invalid resume id");
    return tail ? `/resumes/${id}/time-savings` : `/resumes/${id}`;
  };

  return async (req: Request): Promise<Response | undefined> => {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith(PREFIX)) return undefined;
    const upstream = route(req.method, pathname.slice(PREFIX.length));
    if (upstream instanceof Response) return upstream;

    const init: RequestInit = { method: req.method };
    if (req.method === "POST") {
      const length = Number(req.headers.get("content-length") ?? 0);
      if (length > MAX_UPLOAD_BYTES) return fail(413, "file too large");
      const body = await req.arrayBuffer();
      if (body.byteLength > MAX_UPLOAD_BYTES) return fail(413, "file too large");
      init.body = body;
      const type = req.headers.get("content-type");
      if (type) init.headers = { "Content-Type": type };
    }
    try {
      const res = await fetchFn(`${config.apiUrl}${upstream}`, init);
      const headers: Record<string, string> = { ...base };
      const type = res.headers.get("content-type");
      if (type) headers["Content-Type"] = type;
      return new Response(await res.arrayBuffer(), { status: res.status, headers });
    } catch {
      return fail(502, "AviCV is unreachable");
    }
  };
}
