import { z } from "zod";
import { LOAN_TYPES } from "@/lib/constants";
import {
  dateStringSchema,
  nonNegativeMoneySchema,
  optionalNullableString,
  positiveMoneySchema,
} from "@/lib/validations/common";

const loanTypeValues = LOAN_TYPES.map((t) => t.value) as [
  (typeof LOAN_TYPES)[number]["value"],
  ...(typeof LOAN_TYPES)[number]["value"][],
];

export const loanSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(150),
    bank: z.string().trim().min(1, "Bank is required").max(100),
    loan_type: z.enum(loanTypeValues),
    principal: positiveMoneySchema,
    interest_rate: z.coerce
      .number({ invalid_type_error: "Enter a valid rate" })
      .min(0, "Rate cannot be negative")
      .max(100, "Rate seems too high"),
    interest_type: z.enum(["reducing", "flat"]),
    input_mode: z.enum(["tenure", "emi"]),
    tenure_months: z.coerce
      .number({ invalid_type_error: "Enter tenure in months" })
      .int("Must be a whole number")
      .positive("Tenure must be greater than zero")
      .max(600, "Tenure seems too long"),
    emi: positiveMoneySchema,
    start_date: dateStringSchema,
    processing_fee: nonNegativeMoneySchema,
    insurance_fee: nonNegativeMoneySchema,
    prepayment_charges: z.preprocess(
      (v) => (v === "" || v == null ? 0 : v),
      z.coerce
        .number({ invalid_type_error: "Enter a valid percentage" })
        .min(0)
        .max(100)
    ),
    outstanding_principal: nonNegativeMoneySchema.optional(),
    principal_paid: nonNegativeMoneySchema,
    interest_paid: nonNegativeMoneySchema,
    emis_paid: z.preprocess(
      (v) => (v === "" || v == null ? 0 : v),
      z.coerce
        .number({ invalid_type_error: "Enter EMIs paid" })
        .int()
        .min(0)
    ),
    account_id: z
      .union([z.string().uuid(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    notes: optionalNullableString,
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.emis_paid > data.tenure_months) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "EMIs paid cannot exceed tenure",
        path: ["emis_paid"],
      });
    }
    const outstanding = data.outstanding_principal ?? data.principal;
    if (outstanding > data.principal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Outstanding cannot exceed principal",
        path: ["outstanding_principal"],
      });
    }
  });

export type LoanFormValues = z.infer<typeof loanSchema>;

export const simulationSchema = z.object({
  name: z.string().trim().min(1, "Scenario name is required").max(120),
  strategy: z.enum(["reduce_emi", "reduce_tenure"]),
  one_time_amount: nonNegativeMoneySchema,
  one_time_date: z
    .union([dateStringSchema, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : v)),
  recurring_extra_emi: nonNegativeMoneySchema,
  increased_emi: z
    .union([positiveMoneySchema, z.literal(""), z.null(), z.literal(0)])
    .optional()
    .transform((v) => {
      if (v === "" || v == null || v === 0) return null;
      return v as number;
    }),
  annual_lump_sum: nonNegativeMoneySchema,
  original_emi: positiveMoneySchema,
  new_emi: positiveMoneySchema,
  original_tenure: z.coerce.number().int().positive(),
  new_tenure: z.coerce.number().int().positive(),
  interest_saved: nonNegativeMoneySchema,
  months_saved: z.coerce.number().int().min(0),
  total_savings: nonNegativeMoneySchema,
  schedule_json: z.any().optional().nullable(),
  apply_to_loan: z.boolean().default(false),
});

export type SimulationFormValues = z.infer<typeof simulationSchema>;
