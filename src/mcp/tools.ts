import type { z } from "zod";
import { Profile, SaveVariantInput, Variant } from "./schemas";

export interface ToolDeps {
  fetch: typeof fetch;
  apiUrl: string;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

const TIMEOUT_MS = 10_000;

function ok(data: object): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function fail(tool: string, detail: string): ToolResult {
  return { content: [{ type: "text", text: `${tool} failed: ${detail}` }], isError: true };
}

/** One HTTP call to the app API; never throws. */
async function callApi<T>(
  tool: string,
  deps: ToolDeps,
  method: "GET" | "POST",
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  notFound?: string,
): Promise<ToolResult> {
  let res: Response;
  try {
    res = await deps.fetch(deps.apiUrl + path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fail(tool, err instanceof Error ? err.message : String(err));
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    if (res.status === 404 && notFound) return fail(tool, notFound);
    return fail(tool, `${res.status} ${text.slice(0, 300)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(tool, `invalid JSON response ${text.slice(0, 300)}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail(tool, `unexpected response shape ${parsed.error.message.slice(0, 300)}`);
  }
  return ok(parsed.data as object);
}

export function getProfile(deps: ToolDeps): Promise<ToolResult> {
  return callApi("get_profile", deps, "GET", "/profile", Profile);
}

export function saveVariant(deps: ToolDeps, input: SaveVariantInput): Promise<ToolResult> {
  return callApi(
    "save_variant",
    deps,
    "POST",
    "/cv/variants",
    Variant,
    { job_id: input.job_id, bullets: input.bullets },
    `job ${input.job_id} not found`,
  );
}
