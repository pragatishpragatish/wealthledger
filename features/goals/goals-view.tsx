"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { formatINR, formatPercent } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { GOAL_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  deleteGoal,
  markGoalComplete,
} from "@/features/goals/actions";
import { GoalForm } from "@/features/goals/goal-form";
import type { GoalComputed, GoalsPageData } from "@/features/goals/queries";

const typeLabel = Object.fromEntries(
  GOAL_TYPES.map((t) => [t.value, t.label])
) as Record<string, string>;

export function GoalsView({ data }: { data: GoalsPageData }) {
  const { goals, summary } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalComputed | null>(null);
  const [deleting, setDeleting] = useState<GoalComputed | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(goal: GoalComputed) {
    setEditing(goal);
    setFormOpen(true);
  }

  function handleComplete(goal: GoalComputed) {
    startTransition(async () => {
      const result = await markGoalComplete(goal.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Goal marked complete");
    });
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteGoal(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Goal deleted");
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Savings targets with progress and estimated completion."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add goal
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile title="Active" value={String(summary.activeCount)} />
        <SummaryTile title="Completed" value={String(summary.completedCount)} />
        <SummaryTile title="Target total" value={formatINR(summary.totalTarget)} />
        <SummaryTile title="Saved so far" value={formatINR(summary.totalSaved)} />
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Create a goal to track emergency fund, house, vacation and more."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal, i) => {
            const accent = goal.color ?? "#0F766E";
            return (
              <div
                key={goal.id}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: accent }}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-semibold">
                      {goal.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        {typeLabel[goal.type] ?? goal.type}
                      </Badge>
                      {goal.is_completed && (
                        <Badge
                          variant="outline"
                          className="border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                        >
                          Completed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" />}
                    >
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(goal)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      {!goal.is_completed && (
                        <DropdownMenuItem onClick={() => handleComplete(goal)}>
                          <CheckCircle2 className="size-4" />
                          Mark complete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleting(goal)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-5 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Saved</p>
                    <p className="font-heading text-xl font-semibold tabular-nums">
                      {formatINR(goal.current_amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Target</p>
                    <p className="text-sm font-medium tabular-nums">
                      {formatINR(goal.target_amount)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium tabular-nums">
                      {formatPercent(Math.min(goal.progressPercent, 100))}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(goal.progressPercent, 0))}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Monthly</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {formatINR(goal.monthly_contribution)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {formatINR(goal.remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Target date</p>
                    <p className="mt-0.5 font-medium">
                      {goal.target_date
                        ? formatDisplayDate(goal.target_date)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Est. completion</p>
                    <p
                      className={cn(
                        "mt-0.5 font-medium",
                        !goal.estimatedCompletionDate &&
                          !goal.is_completed &&
                          "text-muted-foreground"
                      )}
                    >
                      {goal.is_completed
                        ? "Done"
                        : goal.estimatedCompletionDate
                          ? formatDisplayDate(goal.estimatedCompletionDate)
                          : goal.monthly_contribution <= 0
                            ? "Set contribution"
                            : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GoalForm open={formOpen} onOpenChange={setFormOpen} goal={editing} />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete goal?"
        description={
          deleting ? `"${deleting.name}" will be permanently removed.` : undefined
        }
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function SummaryTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/5 to-card p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
