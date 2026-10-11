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

// Strict on input: the model must send exactly the Profile shape (spec 07).
export const ProfileInput = z.object({
  name: z.string(),
  headline: z.string(),
  roles: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      company: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      bullets: z.array(z.string()),
    }),
  ),
  projects: z.array(z.object({ id: z.string(), name: z.string(), bullets: z.array(z.string()) })),
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

export const SaveJobInput = z.object({
  title: z.string(),
  company: z.string(),
  description: z.string(),
  url: z.string().optional(),
});

export const SearchJobsInput = z.object({
  board: z.enum(["greenhouse", "lever", "ashby"]),
  company: z.string(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

export const TaskName = z.enum(["find_jobs", "tailor_cv"]);

export const LogTimeSavedInput = z.object({ task: TaskName });

export type Job = z.infer<typeof Job>;
export type SaveJobInput = z.infer<typeof SaveJobInput>;
export type TaskName = z.infer<typeof TaskName>;
export type LogTimeSavedInput = z.infer<typeof LogTimeSavedInput>;
export type Bullet = z.infer<typeof Bullet>;
export type Profile = z.infer<typeof Profile>;
export type ProfileInput = z.infer<typeof ProfileInput>;
export type Variant = z.infer<typeof Variant>;
export type SaveVariantInput = z.infer<typeof SaveVariantInput>;
export type SearchJobsInput = z.input<typeof SearchJobsInput>;
