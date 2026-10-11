/**
 * Shared shape for `useActionState` forms.
 *
 * This lives outside the `"use server"` module because such a file may only
 * export async functions — a plain constant like `IDLE` is rejected at build
 * time.
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const IDLE: ActionState = { status: "idle" };
