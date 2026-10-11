export type Resource = "jobs" | "variants" | "time-saved";

export interface ChangedMessage {
  type: "speedhack:changed";
  resource: Resource;
}

const RESOURCES: Record<string, Resource> = {
  save_job: "jobs",
  save_variant: "variants",
  log_time_saved: "time-saved",
};

const PREFIX = /^cv(?:__|_|\.|\/)/;

export function resourceForTool(name: string): Resource | null {
  const bare = name.replace(PREFIX, "");
  return Object.hasOwn(RESOURCES, bare) ? RESOURCES[bare]! : null;
}

export function changedMessage(resource: Resource): ChangedMessage {
  return { type: "speedhack:changed", resource };
}
