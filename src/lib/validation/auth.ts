import { z } from "zod";

/**
 * Shared validation schemas.
 *
 * The same schema runs in the browser (for immediate feedback) and on the
 * server (as the authoritative check). Client-side validation is never trusted:
 * every server action re-parses its input before touching the database.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "That email is too long")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Passwords must be 128 characters or fewer")
  .refine((value) => /[a-z]/.test(value), "Include a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Include an uppercase letter")
  .refine((value) => /[0-9]/.test(value), "Include a number");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Both passwords must match",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
