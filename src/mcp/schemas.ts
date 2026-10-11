import { z } from "zod";

/** AviCV résumé ids: 32 lowercase hex chars, a bearer capability (spec 08). */
export const RESUME_ID_RE = /^[0-9a-f]{32}$/;

const ResumeId = z.string().describe("The user's AviCV résumé id (32 hex chars)");

export const ResumeInput = z.object({ resume_id: ResumeId });

export const ListMatchesInput = z.object({
  resume_id: ResumeId,
  category: z.enum(["good", "other", "all"]).default("good"),
  nearby: z.boolean().default(false),
  limit: z.number().int().min(1).max(25).default(10),
  offset: z.number().int().min(0).default(0),
});

export const SearchJobsInput = z.object({
  q: z.string().max(500).optional(),
  geo: z.enum(["us_ca", "remote_unspecified", "other", "unknown", "any"]).default("us_ca"),
  limit: z.number().int().min(1).max(25).default(10),
});

export const TailorCvInput = z.object({ resume_id: ResumeId, job_key: z.string().min(1) });

export const GetTailoredCvInput = z.object({ resume_id: ResumeId, tailored_id: z.string().min(1) });

export const RematchInput = z.object({ resume_id: ResumeId, location: z.string().min(1).max(200).optional() });

export type ResumeInput = z.infer<typeof ResumeInput>;
export type ListMatchesInput = z.input<typeof ListMatchesInput>;
export type SearchJobsInput = z.input<typeof SearchJobsInput>;
export type TailorCvInput = z.infer<typeof TailorCvInput>;
export type GetTailoredCvInput = z.infer<typeof GetTailoredCvInput>;
export type RematchInput = z.infer<typeof RematchInput>;
