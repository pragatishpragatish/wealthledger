import { z } from "zod";
import { nonNegativeMoneySchema } from "@/lib/validations/common";

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .max(120, "Name is too long")
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  phone: z
    .string()
    .trim()
    .max(20, "Phone is too long")
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || /^[+]?[\d\s()-]{7,20}$/.test(v),
      "Enter a valid phone number"
    ),
  avatar_url: z
    .string()
    .trim()
    .max(500, "URL is too long")
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || /^https?:\/\/.+/i.test(v) || v.startsWith("/"),
      "Enter a valid URL"
    ),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const themeSchema = z.enum(["light", "dark", "system"]);

export const notificationPrefsSchema = z.object({
  notify_emi: z.boolean(),
  notify_credit_card: z.boolean(),
  notify_budget: z.boolean(),
  notify_large_expense: z.boolean(),
  notify_investment_maturity: z.boolean(),
  notify_investment_update: z.boolean(),
  notify_goal_milestones: z.boolean(),
  large_expense_threshold: nonNegativeMoneySchema,
});

export type NotificationPrefsValues = z.infer<typeof notificationPrefsSchema>;
