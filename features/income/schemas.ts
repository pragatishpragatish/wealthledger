import { z } from "zod";
import { RECURRING_FREQUENCIES } from "@/lib/constants";
import {
  dateStringSchema,
  optionalNullableString,
  positiveMoneySchema,
} from "@/lib/validations/common";

const frequencyValues = RECURRING_FREQUENCIES.map((f) => f.value) as [
  (typeof RECURRING_FREQUENCIES)[number]["value"],
  ...(typeof RECURRING_FREQUENCIES)[number]["value"][],
];

export const incomeSchema = z
  .object({
    date: dateStringSchema,
    amount: positiveMoneySchema,
    category_id: z.string().uuid("Select a category").optional().nullable(),
    account_id: z.string().uuid("Select an account"),
    notes: optionalNullableString,
    is_recurring: z.boolean(),
    recurring_frequency: z.enum(frequencyValues).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.is_recurring && !data.recurring_frequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a frequency for recurring income",
        path: ["recurring_frequency"],
      });
    }
  });

export type IncomeFormValues = z.infer<typeof incomeSchema>;
