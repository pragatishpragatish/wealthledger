import { z } from "zod";
import { positiveMoneySchema } from "@/lib/validations/common";

export const budgetSchema = z
  .object({
    category_id: z.string().uuid("Select a category"),
    period: z.enum(["monthly", "yearly"]),
    year: z.coerce
      .number({ invalid_type_error: "Enter a valid year" })
      .int()
      .min(2000, "Year must be 2000 or later")
      .max(2100, "Year seems too far"),
    month: z.coerce
      .number({ invalid_type_error: "Select a month" })
      .int()
      .min(1)
      .max(12)
      .optional()
      .nullable(),
    amount: positiveMoneySchema,
  })
  .superRefine((data, ctx) => {
    if (data.period === "monthly" && (data.month == null || data.month < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Month is required for monthly budgets",
        path: ["month"],
      });
    }
  });

export type BudgetFormValues = z.infer<typeof budgetSchema>;
