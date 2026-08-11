import { addMonths } from "date-fns";
import { requireUser } from "@/lib/auth";
import { toDateString } from "@/utils/date";
import type { Goal } from "@/types";

export type GoalComputed = Goal & {
  progressPercent: number;
  remaining: number;
  estimatedCompletionDate: string | null;
  estimatedMonths: number | null;
};

export type GoalsPageData = {
  goals: GoalComputed[];
  summary: {
    activeCount: number;
    completedCount: number;
    totalTarget: number;
    totalSaved: number;
  };
};

function computeGoal(row: Record<string, unknown>): GoalComputed {
  const target_amount = Number(row.target_amount);
  const current_amount = Number(row.current_amount);
  const monthly_contribution = Number(row.monthly_contribution);
  const remaining = Math.max(0, target_amount - current_amount);
  const progressPercent =
    target_amount > 0 ? (current_amount / target_amount) * 100 : 0;

  let estimatedMonths: number | null = null;
  let estimatedCompletionDate: string | null = null;

  if (!row.is_completed && remaining > 0 && monthly_contribution > 0) {
    estimatedMonths = Math.ceil(remaining / monthly_contribution);
    estimatedCompletionDate = toDateString(
      addMonths(new Date(), estimatedMonths)
    );
  } else if (row.is_completed || remaining <= 0) {
    estimatedMonths = 0;
    estimatedCompletionDate = toDateString(new Date());
  }

  return {
    ...(row as unknown as Goal),
    target_amount,
    current_amount,
    monthly_contribution,
    remaining,
    progressPercent,
    estimatedMonths,
    estimatedCompletionDate,
  };
}

export async function getGoalsPageData(): Promise<GoalsPageData> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("is_completed", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const goals = (data ?? []).map((row) =>
    computeGoal(row as Record<string, unknown>)
  );

  const active = goals.filter((g) => !g.is_completed);
  const completed = goals.filter((g) => g.is_completed);

  return {
    goals,
    summary: {
      activeCount: active.length,
      completedCount: completed.length,
      totalTarget: active.reduce((s, g) => s + g.target_amount, 0),
      totalSaved: active.reduce((s, g) => s + g.current_amount, 0),
    },
  };
}
