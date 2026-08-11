"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  List,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR } from "@/utils/currency";
import { formatDisplayDate, formatShortDate } from "@/utils/date";
import { cn } from "@/lib/utils";
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarPageData,
} from "@/features/calendar/queries";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const typeMeta: Record<
  CalendarEventType,
  { label: string; icon: typeof CreditCard; className: string }
> = {
  credit_card: {
    label: "Card due",
    icon: CreditCard,
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  emi: {
    label: "EMI",
    icon: Landmark,
    className: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  },
  maturity: {
    label: "Maturity",
    icon: TrendingUp,
    className: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
  },
  sip: {
    label: "SIP",
    icon: TrendingUp,
    className: "bg-teal-500/15 text-teal-800 dark:text-teal-300",
  },
  goal: {
    label: "Goal",
    icon: Target,
    className: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  },
  income: {
    label: "Income",
    icon: Wallet,
    className: "bg-teal-500/15 text-teal-800 dark:text-teal-300",
  },
};

export function CalendarView({ data }: { data: CalendarPageData }) {
  const router = useRouter();
  const { year, month, monthLabel, days, events, upcoming } = data;
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return events;
    return events.filter((e) => e.date === selectedDate);
  }, [events, selectedDate]);

  function navigate(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    const params = new URLSearchParams();
    params.set("year", String(d.getFullYear()));
    params.set("month", String(d.getMonth() + 1));
    router.push(`/calendar?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Calendar"
        description="Upcoming dues, EMIs, maturities, goals and recurring income."
        action={
          <Tabs
            value={mode}
            onValueChange={(v) => {
              if (v === "calendar" || v === "list") setMode(v);
            }}
          >
            <TabsList>
              <TabsTrigger value="calendar">
                <CalendarDays className="size-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="size-4" />
                Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="icon-sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="size-4" />
          <span className="sr-only">Previous month</span>
        </Button>
        <h2 className="font-heading text-lg font-semibold">{monthLabel}</h2>
        <Button variant="outline" size="icon-sm" onClick={() => navigate(1)}>
          <ChevronRight className="size-4" />
          <span className="sr-only">Next month</span>
        </Button>
      </div>

      {mode === "calendar" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const hasEvents = day.events.length > 0;
                const isSelected = selectedDate === day.date;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() =>
                      setSelectedDate(isSelected ? null : day.date)
                    }
                    className={cn(
                      "flex min-h-16 flex-col items-start rounded-xl border p-1.5 text-left transition-colors sm:min-h-20 sm:p-2",
                      day.inMonth
                        ? "border-transparent bg-muted/20 hover:bg-muted/40"
                        : "border-transparent bg-transparent text-muted-foreground/40",
                      day.isToday && "ring-1 ring-teal-600/50",
                      isSelected && "border-teal-600/40 bg-teal-500/10"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        day.isToday && "text-teal-700 dark:text-teal-300"
                      )}
                    >
                      {day.day}
                    </span>
                    {hasEvents && day.inMonth && (
                      <div className="mt-auto flex w-full flex-wrap gap-0.5">
                        {day.events.slice(0, 3).map((e) => (
                          <span
                            key={e.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              e.type === "credit_card" && "bg-amber-500",
                              e.type === "emi" && "bg-rose-500",
                              e.type === "maturity" && "bg-blue-500",
                              e.type === "goal" && "bg-violet-500",
                              e.type === "income" && "bg-teal-500"
                            )}
                          />
                        ))}
                        {day.events.length > 3 && (
                          <span className="text-[9px] text-muted-foreground">
                            +{day.events.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {selectedDate
                ? formatDisplayDate(selectedDate)
                : "This month"}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events{selectedDate ? " on this day" : " this month"}.
              </p>
            ) : (
              <EventList events={selectedEvents} />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing upcoming"
              description="Credit card dues, EMIs, maturities and goals will show here."
            />
          ) : (
            <Timeline events={upcoming} />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(typeMeta) as CalendarEventType[]).map((type) => {
          const meta = typeMeta[type];
          return (
            <Badge key={type} variant="outline" className={meta.className}>
              {meta.label}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

function EventList({ events }: { events: CalendarEvent[] }) {
  return (
    <ul className="divide-y divide-border/50">
      {events.map((event, i) => {
        const meta = typeMeta[event.type];
        const Icon = meta.icon;
        return (
          <li
            key={event.id}
          >
            <Link
              href={event.href}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-90"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                  meta.className
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {meta.label}
                  {event.subtitle ? ` · ${event.subtitle}` : ""}
                </p>
              </div>
              {event.amount != null && (
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatINR(event.amount)}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Timeline({ events }: { events: CalendarEvent[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="space-y-6">
      {grouped.map(([date, dayEvents]) => (
        <div key={date}>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            {formatDisplayDate(date)}
            <span className="ml-2 text-xs">({formatShortDate(date)})</span>
          </h3>
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <EventList events={dayEvents} />
          </div>
        </div>
      ))}
    </div>
  );
}
