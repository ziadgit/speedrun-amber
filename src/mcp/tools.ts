import type { z } from "zod";
import {
  Job,
  LogTimeSavedInput as LogTimeSavedSchema,
  Profile,
  ProfileInput as ProfileInputSchema,
  type ProfileInput,
  SaveJobInput as SaveJobSchema,
  SaveVariantInput as SaveVariantSchema,
  SaveJobInput,
  SaveVariantInput,
  SearchJobsInput as SearchJobsSchema,
  type SearchJobsInput,
  TimeSaved,
  Variant,
  type LogTimeSavedInput,
  type TaskName,
} from "./schemas";

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

export const BASELINE_SECONDS: Record<TaskName, number> = {
  find_jobs: 1200,
  tailor_cv: 1800,
};

/** Deps for tools that measure time: `now` is epoch ms, `startedAt` the session's first call. */
export interface ClockDeps extends ToolDeps {
  now: () => number;
  startedAt: number;
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
  method: "GET" | "POST" | "PUT",
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
  return callApi(
    "get_profile",
    deps,
    "GET",
    "/profile",
    Profile,
    undefined,
    "no profile yet; ask the user to upload their CV",
  );
}

export function saveProfile(deps: ToolDeps, input: ProfileInput): Promise<ToolResult> {
  return callApi("save_profile", deps, "PUT", "/profile", Profile, input);
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

export function saveJob(deps: ToolDeps, input: SaveJobInput): Promise<ToolResult> {
  const body: Record<string, unknown> = {
    title: input.title,
    company: input.company,
    description: input.description,
  };
  if (input.url !== undefined) body.url = input.url;
  return callApi("save_job", deps, "POST", "/jobs", Job, body);
}

export function logTimeSaved(deps: ClockDeps, input: LogTimeSavedInput): Promise<ToolResult> {
  const secondsTaken = Math.max(1, Math.round((deps.now() - deps.startedAt) / 1000));
  return callApi("log_time_saved", deps, "POST", "/time-saved", TimeSaved, {
    task: input.task,
    seconds_taken: secondsTaken,
    baseline_seconds: BASELINE_SECONDS[input.task],
  });
}

const BOARD_URLS: Record<SearchJobsInput["board"], (company: string) => string> = {
  greenhouse: (c) => `https://boards-api.greenhouse.io/v1/boards/${c}/jobs?content=true`,
  lever: (c) => `https://api.lever.co/v0/postings/${c}?mode=json`,
  ashby: (c) => `https://api.ashbyhq.com/posting-api/job-board/${c}`,
};

const COMPANY_RE = /^[a-z0-9-]{1,64}$/;
const DESCRIPTION_MAX = 1500;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "\u2014", ndash: "\u2013",
};

// One pass, so `&amp;lt;` becomes `&lt;` and not `<`.
function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-z]+));/g, (m, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name] ?? m;
    const cp = dec ? Number(dec) : parseInt(hex, 16);
    return cp > 0 && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff) ? String.fromCodePoint(cp) : m;
  });
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

interface BoardJob {
  title: string;
  location: string | null;
  url: string;
  description: string;
  company?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

function parseBoard(board: SearchJobsInput["board"], body: unknown): BoardJob[] {
  const list = Array.isArray(body) ? body : rec(body).jobs;
  if (!Array.isArray(list)) throw new Error("no job list");
  const out: BoardJob[] = [];
  for (const raw of list) {
    const j = rec(raw);
    let title: string | undefined;
    let url: string | undefined;
    let location: string | undefined;
    let description: string;
    let company: string | undefined;
    if (board === "greenhouse") {
      title = str(j.title);
      url = str(j.absolute_url);
      location = str(rec(j.location).name);
      description = decodeEntities(stripHtml(decodeEntities(str(j.content) ?? "")));
      company = str(j.company_name);
    } else if (board === "lever") {
      title = str(j.text);
      url = str(j.hostedUrl);
      location = str(rec(j.categories).location);
      description = stripHtml(str(j.descriptionPlain) ?? "");
    } else {
      title = str(j.title);
      url = str(j.jobUrl);
      location = str(j.location);
      description = stripHtml(str(j.descriptionPlain) ?? "");
    }
    if (title === undefined || url === undefined) continue;
    try {
      if (new URL(url).protocol !== "https:") continue;
    } catch {
      continue;
    }
    out.push({
      title: title.trim(),
      location: location?.trim() || null,
      url,
      description: description.slice(0, DESCRIPTION_MAX),
      company,
    });
  }
  return out;
}

/** The one tool that does not call the app API: one GET to a public job board. */
export async function searchJobs(deps: Pick<ToolDeps, "fetch">, input: SearchJobsInput): Promise<ToolResult> {
  if (!COMPANY_RE.test(input.company)) {
    return fail("search_jobs", "company must match ^[a-z0-9-]{1,64}$");
  }
  const parsed = SearchJobsSchema.safeParse(input);
  if (!parsed.success) return fail("search_jobs", parsed.error.message.slice(0, 300));
  const { board, company, query, limit } = parsed.data;
  let res: Response;
  try {
    res = await deps.fetch(BOARD_URLS[board](company), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    return fail("search_jobs", err instanceof Error ? err.message : String(err));
  }
  const text = await res.text().catch(() => "");
  if (res.status === 404) return fail("search_jobs", `no ${board} board named ${company}`);
  if (!res.ok) return fail("search_jobs", `${res.status} ${text.slice(0, 300)}`);
  let jobs: BoardJob[];
  try {
    jobs = parseBoard(board, JSON.parse(text));
  } catch {
    return fail("search_jobs", `unexpected response shape ${text.slice(0, 300)}`);
  }
  const q = query?.toLowerCase();
  const matched = (q ? jobs.filter((j) => j.title.toLowerCase().includes(q)) : jobs)
    .slice(0, limit)
    .map((j) => ({
      title: j.title,
      company: j.company ?? company,
      location: j.location,
      url: j.url,
      description: j.description,
    }));
  return ok({ jobs: matched });
}

export interface ToolDef {
  name: string;
  description: string;
  /** zod object shape handed to the MCP SDK; empty for tools without input. */
  inputShape: z.ZodRawShape;
  run: (deps: ClockDeps, input: any) => Promise<ToolResult>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_profile",
    description:
      "Read the user's master CV profile: roles, projects and their bullets. Call this before writing any CV variant.",
    inputShape: {},
    run: (deps) => getProfile(deps),
  },
  {
    name: "save_job",
    description: "Save a job posting the user is interested in. Returns the stored job with its id.",
    inputShape: SaveJobSchema.shape,
    run: saveJob,
  },
  {
    name: "save_variant",
    description:
      "Save a CV variant tailored to a saved job. Each bullet must cite the source_id of the profile role or project it was rewritten from. Do not invent experience.",
    inputShape: SaveVariantSchema.shape,
    run: saveVariant,
  },
  {
    name: "save_profile",
    description:
      "Replace the user's master CV profile. Only call this after the user has confirmed the summary you showed them. Copy facts from the CV exactly; never add anything that is not in it.",
    inputShape: ProfileInputSchema.shape,
    run: saveProfile,
  },
  {
    name: "log_time_saved",
    description:
      "Record that you finished a task for the user, so the app can show time saved. Call once after each finished task.",
    inputShape: LogTimeSavedSchema.shape,
    run: logTimeSaved,
  },
  {
    name: "search_jobs",
    description:
      "List open roles from one company's public job board. You must know the company's board name; try the lowercase company name first.",
    inputShape: SearchJobsSchema.shape,
    run: searchJobs,
  },
];
