import { z } from "zod";

export const Bullet = z.looseObject({ source_id: z.string(), text: z.string() });

export const Role = z.looseObject({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  start: z.string(),
  end: z.string().nullable(),
  bullets: z.array(z.string()),
});

export const Project = z.looseObject({
  id: z.string(),
  name: z.string(),
  bullets: z.array(z.string()),
});

export const Profile = z.looseObject({
  name: z.string(),
  headline: z.string(),
  roles: z.array(Role),
  projects: z.array(Project),
});

export const Job = z.looseObject({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  description: z.string(),
  url: z.string().nullable(),
  created_at: z.string(),
});

export const Variant = z.looseObject({
  id: z.string(),
  job_id: z.string(),
  bullets: z.array(Bullet),
  created_at: z.string(),
});

export const TimeSaved = z.looseObject({
  total_seconds_saved: z.number(),
  entries: z.number(),
});

export const SaveVariantInput = z.object({
  job_id: z.string(),
  bullets: z.array(Bullet).min(1),
});

export type Bullet = z.infer<typeof Bullet>;
export type Profile = z.infer<typeof Profile>;
export type Variant = z.infer<typeof Variant>;
export type SaveVariantInput = z.infer<typeof SaveVariantInput>;
