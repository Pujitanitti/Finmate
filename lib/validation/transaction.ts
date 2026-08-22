import { z } from "zod";

export const transactionSchema = z.object({
  merchant: z.string().trim().min(1, "Merchant is required").max(120),
  amount: z.number().positive("Amount must be greater than 0"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().optional().nullable(),
  date: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
