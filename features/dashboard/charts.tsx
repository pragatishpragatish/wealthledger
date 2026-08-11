"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { formatINRCompact } from "@/utils/currency";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import type { AllocationPoint, ChartPoint } from "@/types";

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export function CashFlowChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartCard title="Cash Flow">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F766E" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0F766E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => formatINRCompact(v)}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-muted-foreground"
            width={56}
          />
          <ChartTooltip />
          <Area
            type="monotone"
            dataKey="value"
            name="Net cash flow"
            stroke="#0F766E"
            fill="url(#cashFlowFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function IncomeExpenseChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartCard title="Income vs Expense">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => formatINRCompact(v)}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-muted-foreground"
            width={56}
          />
          <ChartTooltip />
          <Legend />
          <Bar
            dataKey="value"
            name="Income"
            fill="#0F766E"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="secondary"
            name="Expense"
            fill="#E11D48"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SpendingTrendChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartCard title="Spending Trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => formatINRCompact(v)}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-muted-foreground"
            width={56}
          />
          <ChartTooltip />
          <Line
            type="monotone"
            dataKey="value"
            name="Spending"
            stroke="#EA580C"
            strokeWidth={2}
            dot={{ r: 3, fill: "#EA580C" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AllocationChart({
  title,
  data,
}: {
  title: string;
  data: AllocationPoint[];
}) {
  const empty = data.length === 0;
  return (
    <ChartCard title={title}>
      {empty ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color ?? `hsl(${i * 40}, 60%, 45%)`}
                />
              ))}
            </Pie>
            <ChartTooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function NetWorthTrendChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartCard title="Net Worth Trend">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => formatINRCompact(v)}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-muted-foreground"
            width={56}
          />
          <ChartTooltip />
          <Area
            type="monotone"
            dataKey="value"
            name="Net worth"
            stroke="#2563EB"
            fill="url(#nwFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No data yet
    </div>
  );
}
