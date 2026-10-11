import { z } from "zod";

export const taskStatusSchema = z.enum(["TO_DO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this to ${max} characters or fewer`)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value && value.length > 0 ? value : null));

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, "Give the task a clear title").max(200),
  description: optionalText(4000),
  assigneeId: z.string().uuid("Choose who this is for"),
  priority: taskPrioritySchema.default("MEDIUM"),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value && value.length > 0 ? value : null)),
  campaign: optionalText(120),
  client: optionalText(120),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  taskId: z.string().uuid(),
  status: taskStatusSchema.optional(),
});

export const changeTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: taskStatusSchema,
});

export const taskCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a comment first").max(4000),
});

export const taskFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().uuid().optional(),
  due: z.enum(["overdue", "today", "week"]).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type TaskFilterInput = z.infer<typeof taskFilterSchema>;

export const TASK_STATUS_LABELS = {
  TO_DO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
} as const;

export const TASK_PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
} as const;
