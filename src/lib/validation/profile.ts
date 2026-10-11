import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this to ${max} characters or fewer`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

export const phoneSchema = z
  .string()
  .trim()
  .max(24, "That phone number is too long")
  .regex(/^[+]?[0-9 ()-]{7,24}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""))
  .transform((value) => (value && value.length > 0 ? value : null));

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
  .optional()
  .or(z.literal(""))
  .transform((value) => (value && value.length > 0 ? value : null));

/** What an administrator supplies when inviting somebody. */
export const inviteUserSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address").max(254),
    fullName: z.string().trim().min(2, "Enter their full name").max(120),
    role: z.enum(["ADMIN", "MANAGER", "INTERN"]),
    phone: phoneSchema,
    college: optionalText(120),
    course: optionalText(120),
    designation: optionalText(120),
    teamId: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    managerId: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    joiningDate: isoDateSchema,
    internshipEndDate: isoDateSchema,
  })
  .refine(
    (values) =>
      !values.internshipEndDate ||
      !values.joiningDate ||
      values.internshipEndDate >= values.joiningDate,
    { message: "The end date cannot be before the joining date", path: ["internshipEndDate"] },
  )
  .refine((values) => values.role !== "INTERN" || values.managerId !== null, {
    message: "Every intern needs an assigned manager",
    path: ["managerId"],
  });

/** The fields a person may edit on their own profile. */
export const completeProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: phoneSchema,
  college: optionalText(120),
  course: optionalText(120),
});

/** Administrator edits to somebody else's employment record. */
export const adminUpdateProfileSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "MANAGER", "INTERN"]),
  onboardingStatus: z.enum([
    "INVITED",
    "PROFILE_INCOMPLETE",
    "ACTIVE",
    "PAUSED",
    "COMPLETED",
    "OFFBOARDED",
  ]),
  designation: optionalText(120),
  teamId: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  managerId: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  joiningDate: isoDateSchema,
  internshipEndDate: isoDateSchema,
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Give the team a name").max(80),
  description: optionalText(300),
});

export type InviteUserInput = z.input<typeof inviteUserSchema>;
export type CompleteProfileInput = z.input<typeof completeProfileSchema>;
export type AdminUpdateProfileInput = z.input<typeof adminUpdateProfileSchema>;
export type CreateTeamInput = z.input<typeof createTeamSchema>;

/** `Stage Crew` → `stage-crew`, matching the database's slug constraint. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
