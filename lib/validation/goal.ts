import { z } from "zod";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Goal name is required").max(120),
  targetAmount: z.number().positive("Target must be greater than 0"),
  targetDate: z.coerce.date().optional().nullable(),
});

export const contributionSchema = z.object({
  amount: z.number().positive("Contribution must be greater than 0"),
  note: z.string().max(200).optional().nullable(),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;
