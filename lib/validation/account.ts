import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(80),
  type: z.enum(["BANK", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT"]),
  balance: z.number().default(0),
});

export type AccountInput = z.infer<typeof accountSchema>;
