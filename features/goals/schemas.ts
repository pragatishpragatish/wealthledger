import { z } from "zod";
import { GOAL_TYPES } from "@/lib/constants";
import {
  nonNegativeMoneySchema,
  optionalNullableString,
  positiveMoneySchema,
} from "@/lib/validations/common";

const goalTypeValues = GOAL_TYPES.map((g) => g.value) as [
  (typeof GOAL_TYPES)[number]["value"],
  ...(typeof GOAL_TYPES)[number]["value"][],
];

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(goalTypeValues),
  target_amount: positiveMoneySchema,
  current_amount: nonNegativeMoneySchema,
  monthly_contribution: nonNegativeMoneySchema,
  target_date: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v.trim() === "") return null;
      return v.trim();
    })
    .refine(
      (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Use YYYY-MM-DD format"
    ),
  color: optionalNullableString,
  notes: optionalNullableString,
});

export type GoalFormValues = z.infer<typeof goalSchema>;
