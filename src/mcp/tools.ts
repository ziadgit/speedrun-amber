import type { z } from "zod";
import {
  GetTailoredCvInput as GetTailoredCvSchema,
  ListMatchesInput as ListMatchesSchema,
  RESUME_ID_RE,
  RematchInput as RematchSchema,
  ResumeInput as ResumeSchema,
  SearchJobsInput as SearchJobsSchema,
  TailorCvInput as TailorCvSchema,
  type GetTailoredCvInput,
  type ListMatchesInput,
  type RematchInput,
  type ResumeInput,
  type SearchJobsInput,
  type TailorCvInput,
} from "./schemas";

export interface ToolDeps {
  fetch: typeof fetch;
  apiUrl: string;
  /** AviCV's frontend origin: the only host the agent links to (spec 08). */
  appOrigin: string;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

const TIMEOUT_MS = 10_000;

type Obj = Record<string, unknown>;

function ok(data: object): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data as Obj,
  };
}

function fail(tool: string, detail: string): ToolResult {
  return { content: [{ type: "text", text: `${tool} failed: ${detail}` }], isError: true };
}

const rec = (v: unknown): Obj => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("expected an object");
  return v as Obj;
};
const pick = (o: Obj, keys: string[]): Obj => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));

/** Only https URLs reach the model; anything else becomes null. */
function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

/** FastAPI errors carry `detail`: a string, or a validation list we reduce to its messages. */
function errorDetail(text: string): string {
  try {
    const detail = (JSON.parse(text) as Obj).detail;
    if (typeof detail === "string") return detail.slice(0, 300);
    if (Array.isArray(detail)) {
      const msgs = detail.map((d) => (d && typeof d === "object" ? String((d as Obj).msg ?? "") : "")).filter(Boolean);
      if (msgs.length) return msgs.join("; ").slice(0, 300);
    }
  } catch {
    // not JSON; fall through to the raw text
  }
  return text.slice(0, 300);
}

/** One HTTP call to AviCV's API; never throws. `shape` trims the JSON and may throw on a bad shape. */
async function callApi(
  tool: string,
  deps: ToolDeps,
  method: "GET" | "POST",
  path: string,
  shape: (json: unknown) => object,
  body?: unknown,
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
  if (!res.ok) return fail(tool, `${res.status} ${errorDetail(text)}`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(tool, `invalid JSON response ${text.slice(0, 300)}`);
  }
  try {
    return ok(shape(json));
  } catch (err) {
    return fail(tool, `unexpected response shape ${err instanceof Error ? err.message : ""}`.trim());
  }
}

/** Validates the id before any HTTP call and returns the path segment. */
function resumePath(tool: string, id: string): string | ToolResult {
  if (!RESUME_ID_RE.test(id)) return fail(tool, "resume_id must be 32 lowercase hex characters");
  return `/resumes/${encodeURIComponent(id)}`;
}

function downloadUrl(deps: ToolDeps, path: unknown): string | null {
  return typeof path === "string" && path.startsWith("/resumes/") ? deps.appOrigin + path : null;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  return `?${qs}`;
}

export async function getResume(deps: ToolDeps, input: ResumeInput): Promise<ToolResult> {
  const base = resumePath("get_resume", input.resume_id);
  if (typeof base !== "string") return base;
  return callApi("get_resume", deps, "GET", base, (json) => {
    const r = rec(json);
    const cv = r.cv == null ? null : pick(rec(r.cv), ["name", "headline", "location", "sections"]);
    return {
      ...pick(r, ["id", "status", "error", "filename", "progress"]),
      cv,
      effective_location: r.effective_location ?? null,
      page_url: `${deps.appOrigin}/resumes/${encodeURIComponent(input.resume_id)}`,
    };
  });
}

const MATCH_FIELDS = [
  "job_key", "title", "company", "locations", "workplace_type", "salary_min", "salary_max",
  "salary_currency", "salary_interval", "posted_at", "score", "fit", "interview", "must_haves",
  "seniority", "catalog_status",
];

export function listMatches(deps: ToolDeps, rawInput: ListMatchesInput): Promise<ToolResult> | ToolResult {
  const base = resumePath("list_matches", rawInput.resume_id);
  if (typeof base !== "string") return base;
  const parsed = ListMatchesSchema.safeParse(rawInput);
  if (!parsed.success) return fail("list_matches", parsed.error.message.slice(0, 300));
  const { category, nearby, limit, offset } = parsed.data;
  return callApi("list_matches", deps, "GET", `${base}/match-results${query({ category, nearby, limit, offset })}`, (json) => {
    const r = rec(json);
    if (!Array.isArray(r.items)) throw new Error("items is not a list");
    return {
      ...pick(r, ["total", "good_total", "other_total", "has_more", "effective_location"]),
      items: r.items.map((raw) => {
        const m = rec(raw);
        return { ...pick(m, MATCH_FIELDS), url: httpsUrl(m.url) };
      }),
    };
  });
}

export function searchJobs(deps: ToolDeps, rawInput: SearchJobsInput): Promise<ToolResult> | ToolResult {
  const parsed = SearchJobsSchema.safeParse(rawInput);
  if (!parsed.success) return fail("search_jobs", parsed.error.message.slice(0, 300));
  const { q, geo, limit } = parsed.data;
  return callApi("search_jobs", deps, "GET", `/jobs${query({ q, geo, limit })}`, (json) => {
    const r = rec(json);
    if (!Array.isArray(r.jobs)) throw new Error("jobs is not a list");
    return {
      ...pick(r, ["synced", "total"]),
      jobs: r.jobs.map((raw) => {
        const j = rec(raw);
        return {
          ...pick(j, ["id", "company", "title", "locations", "workplace_type", "posted_at"]),
          url: httpsUrl(j.url),
          ...pick(j, ["salary_min", "salary_max", "salary_currency"]),
        };
      }),
    };
  });
}

export function jobStats(deps: ToolDeps): Promise<ToolResult> {
  return callApi("job_stats", deps, "GET", "/jobs/stats", (json) =>
    pick(rec(json), ["synced", "open_jobs", "by_provider", "last_success_at"]),
  );
}

function tailoredShape(deps: ToolDeps) {
  return (json: unknown) => {
    const r = rec(json);
    return { ...pick(r, ["id", "status", "error"]), download_url: downloadUrl(deps, r.download_url) };
  };
}

export function tailorCv(deps: ToolDeps, input: TailorCvInput): Promise<ToolResult> | ToolResult {
  const base = resumePath("tailor_cv", input.resume_id);
  if (typeof base !== "string") return base;
  return callApi("tailor_cv", deps, "POST", `${base}/tailor`, tailoredShape(deps), { job_key: input.job_key });
}

export function getTailoredCv(deps: ToolDeps, input: GetTailoredCvInput): Promise<ToolResult> | ToolResult {
  const base = resumePath("get_tailored_cv", input.resume_id);
  if (typeof base !== "string") return base;
  return callApi("get_tailored_cv", deps, "GET", `${base}/tailored/${encodeURIComponent(input.tailored_id)}`, tailoredShape(deps));
}

export function rematch(deps: ToolDeps, input: RematchInput): Promise<ToolResult> | ToolResult {
  const base = resumePath("rematch", input.resume_id);
  if (typeof base !== "string") return base;
  const body = input.location === undefined ? undefined : { location: input.location };
  return callApi("rematch", deps, "POST", `${base}/rematch`, (json) => pick(rec(json), ["id"]), body);
}

export function getTimeSavings(deps: ToolDeps, input: ResumeInput): Promise<ToolResult> | ToolResult {
  const base = resumePath("get_time_savings", input.resume_id);
  if (typeof base !== "string") return base;
  return callApi("get_time_savings", deps, "GET", `${base}/time-savings`, rec);
}

export interface ToolDef {
  name: string;
  description: string;
  /** zod object shape handed to the MCP SDK; empty for tools without input. */
  inputShape: z.ZodRawShape;
  run: (deps: ToolDeps, input: any) => Promise<ToolResult> | ToolResult;
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_resume",
    description:
      "Read the user's AviCV résumé: parsing and matching status, progress, and the parsed CV. Call this first in every conversation.",
    inputShape: ResumeSchema.shape,
    run: getResume,
  },
  {
    name: "list_matches",
    description:
      "List jobs AviCV ranked against the user's CV, best first. score, fit, interview and must_haves are 0–1; 'good' means score above 0.8.",
    inputShape: ListMatchesSchema.shape,
    run: listMatches,
  },
  {
    name: "search_jobs",
    description:
      "Full-text search over AviCV's catalog of open jobs (SQLite FTS5 syntax allowed). Use list_matches instead when the user wants jobs that fit their CV.",
    inputShape: SearchJobsSchema.shape,
    run: searchJobs,
  },
  {
    name: "job_stats",
    description: "How many open jobs AviCV has indexed, by source, and when it last synced.",
    inputShape: {},
    run: (deps) => jobStats(deps),
  },
  {
    name: "tailor_cv",
    description:
      "Ask AviCV to write a tailored CV PDF for one of the user's matches. job_key must come from list_matches. Returns immediately; the CV takes a minute or two.",
    inputShape: TailorCvSchema.shape,
    run: tailorCv,
  },
  {
    name: "get_tailored_cv",
    description: "Check a tailored CV. When status is ready, give the user download_url.",
    inputShape: GetTailoredCvSchema.shape,
    run: getTailoredCv,
  },
  {
    name: "rematch",
    description: "Re-rank the user's matches, optionally for a different location. Takes a few minutes.",
    inputShape: RematchSchema.shape,
    run: rematch,
  },
  {
    name: "get_time_savings",
    description: "How much time AviCV has saved the user so far.",
    inputShape: ResumeSchema.shape,
    run: getTimeSavings,
  },
];
