import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";
import {
  dateStringSchema,
  positiveMoneySchema,
} from "@/lib/validations/common";

const paymentMethodValues = PAYMENT_METHODS.map((m) => m.value) as [
  (typeof PAYMENT_METHODS)[number]["value"],
  ...(typeof PAYMENT_METHODS)[number]["value"][],
];

export const transactionTypeSchema = z.enum([
  "income",
  "expense",
  "transfer",
  "adjustment",
]);

const optionalUuid = z.union([z.string().uuid(), z.literal(""), z.null()]);

export const transactionSchema = z
  .object({
    type: transactionTypeSchema,
    date: dateStringSchema,
    amount: positiveMoneySchema,
    category_id: optionalUuid,
    account_id: optionalUuid,
    to_account_id: optionalUuid,
    merchant: z.string().nullable(),
    notes: z.string().nullable(),
    payment_method: z.union([
      z.enum(paymentMethodValues),
      z.literal(""),
      z.null(),
    ]),
    tags: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer") {
      if (!data.account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "From account is required for transfers",
          path: ["account_id"],
        });
      }
      if (!data.to_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "To account is required for transfers",
          path: ["to_account_id"],
        });
      }
      if (
        data.account_id &&
        data.to_account_id &&
        data.account_id === data.to_account_id
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "From and to accounts must differ",
          path: ["to_account_id"],
        });
      }
    } else if (
      (data.type === "income" ||
        data.type === "expense" ||
        data.type === "adjustment") &&
      !data.account_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Account is required",
        path: ["account_id"],
      });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export function normalizeTransactionValues(values: TransactionFormValues) {
  const empty = (v: string | null | undefined) =>
    !v || v === "" ? null : v;

  return {
    type: values.type,
    date: values.date,
    amount: values.amount,
    category_id: empty(values.category_id),
    account_id: empty(values.account_id),
    to_account_id:
      values.type === "transfer" ? empty(values.to_account_id) : null,
    merchant: empty(values.merchant),
    notes: empty(values.notes),
    payment_method: empty(values.payment_method) as
      | TransactionFormValues["payment_method"]
      | null,
    tags: values.tags?.trim() || undefined,
  };
}
