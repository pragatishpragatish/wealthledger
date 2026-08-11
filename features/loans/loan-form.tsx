"use client";

import { useEffect, useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOAN_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatINR } from "@/utils/currency";
import { toDateString } from "@/utils/date";
import { loanSchema, type LoanFormValues } from "@/features/loans/schemas";
import { createLoan, updateLoan } from "@/features/loans/actions";
import {
  resolveEmi,
  resolveTenure,
} from "@/features/loans/loan-math";
import type { LoanComputed } from "@/features/loans/queries";
import type { Account, InterestType, LoanInputMode } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan?: LoanComputed | null;
  accounts: Pick<Account, "id" | "name" | "bank_name">[];
};

function defaults(loan?: LoanComputed | null): LoanFormValues {
  if (loan) {
    return {
      name: loan.name,
      bank: loan.bank,
      loan_type: loan.loan_type,
      principal: loan.principal,
      interest_rate: loan.interest_rate,
      interest_type: loan.interest_type,
      input_mode: loan.input_mode,
      tenure_months: loan.tenure_months,
      emi: loan.emi,
      start_date: loan.start_date,
      processing_fee: loan.processing_fee,
      insurance_fee: loan.insurance_fee,
      prepayment_charges: loan.prepayment_charges,
      outstanding_principal: loan.outstanding_principal,
      principal_paid: loan.principal_paid,
      interest_paid: loan.interest_paid,
      emis_paid: loan.emis_paid,
      account_id: loan.account_id,
      notes: loan.notes,
      is_active: loan.is_active,
    };
  }
  return {
    name: "",
    bank: "",
    loan_type: "home",
    principal: 0,
    interest_rate: 8.5,
    interest_type: "reducing",
    input_mode: "tenure",
    tenure_months: 240,
    emi: 0,
    start_date: toDateString(new Date()),
    processing_fee: 0,
    insurance_fee: 0,
    prepayment_charges: 0,
    outstanding_principal: 0,
    principal_paid: 0,
    interest_paid: 0,
    emis_paid: 0,
    account_id: null,
    notes: null,
    is_active: true,
  };
}

function recalculate(
  mode: LoanInputMode,
  interestType: InterestType,
  principal: number,
  rate: number,
  tenure: number,
  emi: number
): { tenure_months: number; emi: number } {
  if (principal <= 0 || rate < 0) return { tenure_months: tenure, emi };
  if (mode === "tenure") {
    if (tenure <= 0) return { tenure_months: tenure, emi };
    return {
      tenure_months: tenure,
      emi: resolveEmi(principal, rate, tenure, interestType),
    };
  }
  if (emi <= 0) return { tenure_months: tenure, emi };
  const n = resolveTenure(principal, rate, emi, interestType);
  return {
    tenure_months: Number.isFinite(n) ? n : tenure,
    emi,
  };
}

export function LoanForm({ open, onOpenChange, loan, accounts }: Props) {
  const isEdit = Boolean(loan);
  const [pending, startTransition] = useTransition();

  const form = useForm<z.input<typeof loanSchema>, unknown, LoanFormValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: defaults(loan),
  });

  const inputMode = useWatch({ control: form.control, name: "input_mode" });
  const interestType = useWatch({
    control: form.control,
    name: "interest_type",
  });
  const principal = Number(
    useWatch({ control: form.control, name: "principal" }) ?? 0
  );
  const rate = Number(
    useWatch({ control: form.control, name: "interest_rate" }) ?? 0
  );
  const tenure = Number(
    useWatch({ control: form.control, name: "tenure_months" }) ?? 0
  );
  const emi = Number(useWatch({ control: form.control, name: "emi" }) ?? 0);

  useEffect(() => {
    if (open) form.reset(defaults(loan));
  }, [open, loan, form]);

  useEffect(() => {
    if (!open) return;
    const next = recalculate(
      (inputMode as LoanInputMode) ?? "tenure",
      (interestType as InterestType) ?? "reducing",
      principal,
      rate,
      tenure,
      emi
    );
    if (inputMode === "tenure" && next.emi !== emi && principal > 0 && tenure > 0) {
      form.setValue("emi", next.emi, { shouldValidate: true });
      if (!isEdit) {
        form.setValue("outstanding_principal", principal, {
          shouldValidate: false,
        });
      }
    }
    if (
      inputMode === "emi" &&
      next.tenure_months !== tenure &&
      principal > 0 &&
      emi > 0
    ) {
      form.setValue("tenure_months", next.tenure_months, {
        shouldValidate: true,
      });
      if (!isEdit) {
        form.setValue("outstanding_principal", principal, {
          shouldValidate: false,
        });
      }
    }
  }, [
    open,
    inputMode,
    interestType,
    principal,
    rate,
    tenure,
    emi,
    form,
    isEdit,
  ]);

  function setMode(mode: LoanInputMode) {
    const next = recalculate(
      mode,
      (interestType as InterestType) ?? "reducing",
      principal,
      rate,
      tenure,
      emi
    );
    form.setValue("input_mode", mode);
    form.setValue("emi", next.emi);
    form.setValue("tenure_months", next.tenure_months);
  }

  function onSubmit(values: LoanFormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        outstanding_principal:
          values.outstanding_principal && values.outstanding_principal > 0
            ? values.outstanding_principal
            : values.principal,
      };

      const result =
        isEdit && loan
          ? await updateLoan(loan.id, payload)
          : await createLoan(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Loan updated" : "Loan added");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit loan" : "Add loan"}</DialogTitle>
          <DialogDescription>
            Mode A computes EMI from tenure; Mode B computes tenure from EMI.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[75vh] gap-4 overflow-y-auto py-1"
         autoComplete="off"
         >
          <div className="flex rounded-lg border border-border/60 bg-muted/40 p-1">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                inputMode === "tenure"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("tenure")}
            >
              Mode A · Tenure → EMI
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                inputMode === "emi"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("emi")}
            >
              Mode B · EMI → Tenure
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loan-name">Name</Label>
              <Input
                id="loan-name"
                placeholder="e.g. Home Loan"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-bank">Bank</Label>
              <Input
                id="loan-bank"
                placeholder="e.g. SBI"
                {...form.register("bank")}
                aria-invalid={!!form.formState.errors.bank}
              />
              {form.formState.errors.bank && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bank.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Loan type</Label>
              <Controller
                control={form.control}
                name="loan_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v != null) field.onChange(v);
                    }}
                    items={Object.fromEntries(
                      LOAN_TYPES.map((t) => [t.value, t.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Interest type</Label>
              <Controller
                control={form.control}
                name="interest_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v != null) field.onChange(v);
                    }}
                    items={{ reducing: "Reducing", flat: "Flat" }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reducing">Reducing</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="loan-principal">Principal (₹)</Label>
              <Input
                id="loan-principal"
                type="number"
                step="0.01"
                min="0"
                {...form.register("principal")}
                aria-invalid={!!form.formState.errors.principal}
              />
              {form.formState.errors.principal && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.principal.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-rate">Interest % p.a.</Label>
              <Input
                id="loan-rate"
                type="number"
                step="0.001"
                min="0"
                {...form.register("interest_rate")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-start">Start date</Label>
              <Input
                id="loan-start"
                type="date"
                {...form.register("start_date")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loan-tenure">
                Tenure (months)
                {inputMode === "emi" ? " · computed" : ""}
              </Label>
              <Input
                id="loan-tenure"
                type="number"
                min="1"
                readOnly={inputMode === "emi"}
                className={inputMode === "emi" ? "bg-muted/50" : undefined}
                {...form.register("tenure_months")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-emi">
                EMI (₹)
                {inputMode === "tenure" ? " · computed" : ""}
              </Label>
              <Input
                id="loan-emi"
                type="number"
                step="0.01"
                min="0"
                readOnly={inputMode === "tenure"}
                className={inputMode === "tenure" ? "bg-muted/50" : undefined}
                {...form.register("emi")}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Preview · </span>
            <span className="font-medium tabular-nums">
              EMI {formatINR(emi || 0)} for {tenure || 0} months
            </span>
            {interestType === "flat" && (
              <span className="text-muted-foreground">
                {" "}
                (flat interest)
              </span>
            )}
          </div>

          {isEdit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loan-outstanding">Outstanding (₹)</Label>
                <Input
                  id="loan-outstanding"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("outstanding_principal")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-emis-paid">EMIs paid</Label>
                <Input
                  id="loan-emis-paid"
                  type="number"
                  min="0"
                  {...form.register("emis_paid")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-principal-paid">Principal paid (₹)</Label>
                <Input
                  id="loan-principal-paid"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("principal_paid")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-interest-paid">Interest paid (₹)</Label>
                <Input
                  id="loan-interest-paid"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("interest_paid")}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="loan-fee">Processing fee (₹)</Label>
              <Input
                id="loan-fee"
                type="number"
                step="0.01"
                min="0"
                {...form.register("processing_fee")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-ins">Insurance fee (₹)</Label>
              <Input
                id="loan-ins"
                type="number"
                step="0.01"
                min="0"
                {...form.register("insurance_fee")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-prepay">Prepay charge %</Label>
              <Input
                id="loan-prepay"
                type="number"
                step="0.01"
                min="0"
                {...form.register("prepayment_charges")}
              />
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Linked account</Label>
              <Controller
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => {
                      if (v == null || v === "none") field.onChange(null);
                      else field.onChange(v);
                    }}
                    items={[
                      { value: "none", label: "None" },
                      ...accounts.map((a) => ({
                        value: a.id,
                        label: `${a.name} · ${a.bank_name}`,
                      })),
                    ]}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="loan-notes">Notes</Label>
            <Textarea
              id="loan-notes"
              rows={2}
              placeholder="Optional notes"
              {...form.register("notes")}
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add loan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
