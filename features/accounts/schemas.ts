import { z } from "zod";
import { ACCOUNT_TYPES } from "@/lib/constants";
import {
  dateStringSchema,
  emptyToNull,
  nonNegativeMoneySchema,
  optionalNullableString,
  positiveMoneySchema,
} from "@/lib/validations/common";

const accountTypeValues = ACCOUNT_TYPES.map((t) => t.value) as [
  (typeof ACCOUNT_TYPES)[number]["value"],
  ...(typeof ACCOUNT_TYPES)[number]["value"][],
];

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(100),
  bank_name: z.string().trim().min(1, "Bank name is required").max(100),
  account_number: z.string().nullable(),
  ifsc: z
    .string()
    .nullable()
    .refine((v) => {
      const cleaned = emptyToNull(v);
      if (cleaned === null) return true;
      return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(cleaned);
    }, "Enter a valid IFSC (e.g. SBIN0001234)"),
  account_type: z.enum(accountTypeValues),
  opening_balance: nonNegativeMoneySchema,
  current_balance: nonNegativeMoneySchema.optional(),
  opening_date: dateStringSchema,
  notes: z.string().nullable(),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

export const updateAccountSchema = accountSchema;

/** Lump-sum brokerage / demat charges debited from a broker wallet. */
export const brokerChargesSchema = z.object({
  account_id: z.string().uuid("Select a broker wallet"),
  amount: positiveMoneySchema,
  date: dateStringSchema,
  notes: optionalNullableString,
});

export type BrokerChargesFormValues = z.infer<typeof brokerChargesSchema>;
