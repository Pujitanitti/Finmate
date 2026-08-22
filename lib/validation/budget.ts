import { z } from "zod";

export const budgetItemSchema = z.object({
  categoryId: z.string().min(1),
  limit: z.number().positive("Budget limit must be greater than 0"),
});

export const budgetSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  items: z.array(budgetItemSchema).min(1, "Add at least one category budget"),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
