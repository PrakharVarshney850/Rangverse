import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this to ${max} characters or fewer`)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value && value.length > 0 ? value : null));

export const evidenceLinkSchema = z
  .string()
  .trim()
  .url("Each link must be a full URL")
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "Only http and https links are allowed",
  );

export const dailyReportSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  summary: z.string().trim().max(4000).optional().or(z.literal("")),
  progress: optionalText(4000),
  blockers: optionalText(4000),
  nextSteps: optionalText(4000),
  evidenceLinks: z.array(evidenceLinkSchema).max(10, "Attach at most 10 links").default([]),
  taskIds: z.array(z.string().uuid()).max(50).default([]),
  intent: z.enum(["SAVE_DRAFT", "SUBMIT"]),
});

/** Submitting requires a summary; a draft does not. */
export const submittableDailyReportSchema = dailyReportSchema.refine(
  (values) => values.intent === "SAVE_DRAFT" || (values.summary ?? "").trim().length > 0,
  { message: "Write a short summary before submitting", path: ["summary"] },
);

export const reviewReportSchema = z.object({
  reportId: z.string().uuid(),
  feedback: z.string().trim().min(1, "Write your feedback first").max(4000),
});

export type DailyReportInput = z.input<typeof dailyReportSchema>;
export type ReviewReportInput = z.input<typeof reviewReportSchema>;
