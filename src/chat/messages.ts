export type Resource = "jobs" | "variants" | "time-saved" | "profile";

export interface ChangedMessage {
  type: "speedhack:changed";
  resource: Resource;
}

const RESOURCES: Record<string, Resource> = {
  save_job: "jobs",
  save_variant: "variants",
  log_time_saved: "time-saved",
  save_profile: "profile",
};

const PREFIX = /^cv(?:__|_|\.|\/)/;

export function resourceForTool(name: string): Resource | null {
  const bare = name.replace(PREFIX, "");
  return Object.hasOwn(RESOURCES, bare) ? RESOURCES[bare]! : null;
}

export function changedMessage(resource: Resource): ChangedMessage {
  return { type: "speedhack:changed", resource };
}

/** cv-tools report failures as text `<tool> failed: <detail>` (see tools.ts). */
const FAILURE = /^\w+ failed: /;

/**
 * The runtime sends `JSON.stringify(<MCP CallToolResult>)`. Failed when that
 * parses to an object with `isError: true`, or (non-JSON) the text starts
 * with `<tool> failed: `.
 */
export function resultFailed(content: string | unknown[]): boolean {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return (parsed as { isError?: unknown }).isError === true;
    }
  } catch {}
  return FAILURE.test(text.trim());
}

/**
 * Posts `speedhack:changed` once per successful cv-tools call. Feed it the
 * agent's tool-call start and result events; `post` is injected so the
 * caller owns `targetOrigin` and the framed-or-not check.
 */
export function createChangeTracker(post: (message: ChangedMessage) => void) {
  const names = new Map<string, string>();
  const done = new Set<string>();
  return {
    started(toolCallId: string, toolCallName: string) {
      names.set(toolCallId, toolCallName);
    },
    result(toolCallId: string, content: string | unknown[]) {
      if (done.has(toolCallId)) return;
      done.add(toolCallId);
      const resource = resourceForTool(names.get(toolCallId) ?? "");
      if (resource && !resultFailed(content)) post(changedMessage(resource));
    },
  };
}
