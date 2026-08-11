"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { toDateString } from "@/utils/date";
import { computeLiveNetWorth } from "@/features/net-worth/queries";

export type NetWorthActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateNetWorthPaths() {
  revalidatePath("/net-worth");
  revalidatePath("/");
}

export async function saveSnapshot(): Promise<NetWorthActionResult> {
  const { supabase, user } = await requireUser();
  const { live } = await computeLiveNetWorth();
  const snapshot_date = toDateString(new Date());

  const { error } = await supabase.from("net_worth_snapshots").upsert(
    {
      user_id: user.id,
      snapshot_date,
      total_cash: live.totalCash,
      total_investments: live.totalInvestments,
      total_assets: live.totalAssets,
      total_liabilities: live.totalLiabilities,
      credit_card_outstanding: live.creditCardOutstanding,
      loan_outstanding: live.loanOutstanding,
      net_worth: live.netWorth,
    },
    { onConflict: "user_id,snapshot_date" }
  );

  if (error) return { error: error.message };

  revalidateNetWorthPaths();
  return { success: true };
}

export async function deleteSnapshot(
  id: string
): Promise<NetWorthActionResult> {
  if (!id) return { error: "Snapshot id is required" };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("net_worth_snapshots")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateNetWorthPaths();
  return { success: true };
}
