import type { z } from "zod";
import {
  Job,
  LogTimeSavedInput as LogTimeSavedSchema,
  Profile,
  SaveJobInput as SaveJobSchema,
  SaveVariantInput as SaveVariantSchema,
  SaveJobInput,
  SaveVariantInput,
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
    name: "log_time_saved",
    description:
      "Record that you finished a task for the user, so the app can show time saved. Call once after each finished task.",
    inputShape: LogTimeSavedSchema.shape,
    run: logTimeSaved,
  },
];
