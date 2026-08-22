import { z } from "zod";

export const recurringPaymentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  amount: z.number().positive("Amount must be greater than 0"),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  categoryId: z.string().min(1, "Category is required"),
  nextDueDate: z.coerce.date(),
});

export type RecurringPaymentInput = z.infer<typeof recurringPaymentSchema>;
