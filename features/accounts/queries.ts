import { requireUser } from "@/lib/auth";
import type { Account } from "@/types";

export type AccountsSummary = {
  totalCash: number;
  accountCount: number;
  byBank: { bank: string; balance: number }[];
};

export async function getAccounts(opts?: {
  includeInactive?: boolean;
}): Promise<Account[]> {
  const { supabase, user } = await requireUser();

  let query = supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("bank_name", { ascending: true })
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...row,
    opening_balance: Number(row.opening_balance),
    current_balance: Number(row.current_balance),
  })) as Account[];
}

export async function getAccountsSummary(): Promise<AccountsSummary> {
  const accounts = await getAccounts();
  const totalCash = accounts.reduce((s, a) => s + a.current_balance, 0);

  const bankMap = new Map<string, number>();
  for (const account of accounts) {
    bankMap.set(
      account.bank_name,
      (bankMap.get(account.bank_name) ?? 0) + account.current_balance
    );
  }

  const byBank = Array.from(bankMap.entries())
    .map(([bank, balance]) => ({ bank, balance }))
    .sort((a, b) => b.balance - a.balance);

  return {
    totalCash,
    accountCount: accounts.length,
    byBank,
  };
}

export async function getAccountById(id: string): Promise<Account | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...data,
    opening_balance: Number(data.opening_balance),
    current_balance: Number(data.current_balance),
  } as Account;
}
