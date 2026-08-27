"use client";

import { useEffect, useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import type { z } from "zod";
import { ACCOUNT_TYPES, INVESTMENT_PLATFORMS } from "@/lib/constants";
import { toDateString } from "@/utils/date";
import type { Account } from "@/types";
import { accountSchema } from "@/features/accounts/schemas";
import {
  createAccount,
  updateAccount,
} from "@/features/accounts/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  /** Prefill as broker wallet when opening from “add broker”. */
  defaultBroker?: boolean;
};

function defaults(
  account?: Account | null,
  defaultBroker?: boolean
): z.input<typeof accountSchema> {
  if (account) {
    return {
      name: account.name,
      bank_name: account.bank_name,
      account_number: account.account_number,
      ifsc: account.ifsc,
      account_type: account.account_type,
      opening_balance: account.opening_balance,
      current_balance: account.current_balance,
      opening_date: account.opening_date,
      notes: account.notes,
    };
  }
  return {
    name: "",
    bank_name: defaultBroker ? "Groww" : "",
    account_number: null,
    ifsc: null,
    account_type: defaultBroker ? "broker_wallet" : "savings",
    opening_balance: undefined,
    current_balance: undefined,
    opening_date: toDateString(new Date()),
    notes: null,
  };
}

export function AccountForm({
  open,
  onOpenChange,
  account,
  defaultBroker = false,
}: Props) {
  const isEdit = Boolean(account);
  const [pending, startTransition] = useTransition();

  const form = useForm<z.input<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: defaults(account, defaultBroker),
  });

  const accountType = useWatch({ control: form.control, name: "account_type" });
  const isBroker = accountType === "broker_wallet";

  useEffect(() => {
    if (open) {
      form.reset(defaults(account, defaultBroker));
    }
  }, [open, account, defaultBroker, form]);

  useEffect(() => {
    if (!isBroker || isEdit) return;
    const broker = form.getValues("bank_name");
    const name = form.getValues("name");
    if (!name.trim() && broker) {
      form.setValue("name", `${broker} Wallet`);
    }
  }, [isBroker, isEdit, form]);

  function onSubmit(values: z.input<typeof accountSchema>) {
    startTransition(async () => {
      const result =
        isEdit && account
          ? await updateAccount(account.id, values)
          : await createAccount(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Account updated" : "Account created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Edit account"
              : isBroker
                ? "Add broker wallet"
                : "Add account"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update account details. Balance changes via transactions and transfers."
              : isBroker
                ? "Track idle cash in a stock broker wallet. Transfer from bank accounts anytime."
                : "Add a bank account, cash/UPI wallet, or stock broker wallet."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[70vh] gap-4 overflow-y-auto py-1"
          autoComplete="off"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Account type</Label>
              <Controller
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v == null) return;
                      field.onChange(v);
                      if (v === "broker_wallet") {
                        const broker =
                          form.getValues("bank_name") || "Groww";
                        if (
                          !INVESTMENT_PLATFORMS.includes(
                            broker as (typeof INVESTMENT_PLATFORMS)[number]
                          )
                        ) {
                          form.setValue("bank_name", "Groww");
                        }
                        const n = form.getValues("name");
                        if (!n.trim()) {
                          form.setValue(
                            "name",
                            `${form.getValues("bank_name") || "Groww"} Wallet`
                          );
                        }
                        form.setValue("ifsc", null);
                      }
                    }}
                    items={Object.fromEntries(
                      ACCOUNT_TYPES.map((t) => [t.value, t.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
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
              <Label htmlFor="opening_date">Opening date</Label>
              <Input
                id="opening_date"
                type="date"
                {...form.register("opening_date")}
                aria-invalid={!!form.formState.errors.opening_date}
              />
              {form.formState.errors.opening_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.opening_date.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Account name</Label>
              <Input
                id="name"
                placeholder={
                  isBroker ? "e.g. Dhan Wallet" : "e.g. Primary Savings"
                }
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
              <Label htmlFor="bank_name">
                {isBroker ? "Broker" : "Bank / Wallet"}
              </Label>
              {isBroker ? (
                <Controller
                  control={form.control}
                  name="bank_name"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v == null) return;
                        field.onChange(v);
                        const currentName = form.getValues("name");
                        if (
                          !currentName.trim() ||
                          /wallet$/i.test(currentName)
                        ) {
                          form.setValue("name", `${v} Wallet`);
                        }
                      }}
                      items={Object.fromEntries(
                        INVESTMENT_PLATFORMS.map((p) => [p, p])
                      )}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select broker" />
                      </SelectTrigger>
                      <SelectContent>
                        {INVESTMENT_PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <Input
                  id="bank_name"
                  placeholder="e.g. HDFC Bank"
                  {...form.register("bank_name")}
                  aria-invalid={!!form.formState.errors.bank_name}
                />
              )}
              {form.formState.errors.bank_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bank_name.message}
                </p>
              )}
            </div>
          </div>

          {!isBroker ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account_number">Account number</Label>
                <Input
                  id="account_number"
                  placeholder="Optional"
                  {...form.register("account_number")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc">IFSC</Label>
                <Input
                  id="ifsc"
                  placeholder="e.g. HDFC0001234"
                  className="uppercase"
                  {...form.register("ifsc")}
                  aria-invalid={!!form.formState.errors.ifsc}
                />
                {form.formState.errors.ifsc && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.ifsc.message}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opening_balance">
                {isEdit
                  ? "Opening balance"
                  : isBroker
                    ? "Wallet balance (₹)"
                    : "Opening balance (₹)"}
              </Label>
              <Input
                id="opening_balance"
                type="number"
                step="0.01"
                min="0"
                placeholder={isBroker ? "e.g. 25000" : undefined}
                {...form.register("opening_balance")}
                aria-invalid={!!form.formState.errors.opening_balance}
              />
              {form.formState.errors.opening_balance && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.opening_balance.message}
                </p>
              )}
              {!isEdit && (
                <p className="text-xs text-muted-foreground">
                  {isBroker
                    ? "Cash currently sitting in this broker wallet. Move money via Transfers."
                    : "Current balance starts equal to opening balance."}
                </p>
              )}
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label>Current balance</Label>
                <Input
                  value={account?.current_balance ?? 0}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Updated by transfers and transactions.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              rows={2}
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
              {isEdit ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
