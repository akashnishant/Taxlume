import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ExpenseReportCurrency,
  ExpenseReportGranularity,
  ScheduledExpenseReportCurrency,
} from "../services/expenseReportApi";

type Props = {
  recorded: ExpenseReportCurrency;
  scheduled?: ScheduledExpenseReportCurrency;
  granularity: ExpenseReportGranularity;
};

type TrendPoint = {
  period: string;
  label: string;
  manual: number;
  generated: number;
  scheduled: number;
};

type CategoryPoint = {
  id: string;
  name: string;
  recorded: number;
  scheduled: number;
};

const COLORS = {
  manual: "#475569",
  generated: "#047857",
  scheduled: "#a3e635",
  grid: "#e2e8f0",
};

function money(amountPaise: number, currencyCode: string): string {
  return `${currencyCode} ${(amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function axisMoney(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amountPaise / 100);
}

function periodLabel(
  period: string,
  granularity: ExpenseReportGranularity,
): string {
  if (granularity === "year") return period;

  const [year, month, day] = period.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    day: granularity === "day" ? "2-digit" : undefined,
    month: "short",
    year: granularity === "month" ? "numeric" : "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day ?? 1)));
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function ExpenseReportCharts({
  recorded,
  scheduled,
  granularity,
}: Props) {
  const currencyCode = recorded.currency_code;
  const formatTooltipAmount = (value: unknown) =>
    money(Number(value ?? 0), currencyCode);

  const trendByPeriod = new Map<string, TrendPoint>();

  for (const period of recorded.periods) {
    trendByPeriod.set(period.period, {
      period: period.period,
      label: periodLabel(period.period, granularity),
      manual: period.manual_paise,
      generated: period.recurring_paise,
      scheduled: 0,
    });
  }

  for (const period of scheduled?.periods ?? []) {
    const existing = trendByPeriod.get(period.period);

    if (existing) {
      existing.scheduled += period.scheduled_paise;
    } else {
      trendByPeriod.set(period.period, {
        period: period.period,
        label: periodLabel(period.period, granularity),
        manual: 0,
        generated: 0,
        scheduled: period.scheduled_paise,
      });
    }
  }

  const allTrendPoints = [...trendByPeriod.values()].sort(
    (first, second) => first.period.localeCompare(second.period),
  );

  // Keep daily charts readable for large date ranges.
  // The report tables continue to show every returned period.
  const trendPoints = allTrendPoints.slice(-30);
  const trendIsLimited = allTrendPoints.length > trendPoints.length;

  const categoryById = new Map<string, CategoryPoint>();

  for (const category of recorded.categories) {
    categoryById.set(category.category_id, {
      id: category.category_id,
      name: category.parent_category_name
        ? `${category.parent_category_name} / ${category.category_name}`
        : category.category_name,
      recorded: category.total_paise,
      scheduled: 0,
    });
  }

  for (const category of scheduled?.categories ?? []) {
    const existing = categoryById.get(category.category_id);

    if (existing) {
      existing.scheduled += category.scheduled_paise;
    } else {
      categoryById.set(category.category_id, {
        id: category.category_id,
        name: category.parent_category_name
          ? `${category.parent_category_name} / ${category.category_name}`
          : category.category_name,
        recorded: 0,
        scheduled: category.scheduled_paise,
      });
    }
  }

  const topCategories = [...categoryById.values()]
    .sort(
      (first, second) =>
        second.recorded +
          second.scheduled -
          (first.recorded + first.scheduled),
    )
    .slice(0, 5);

  const composition = [
    {
      name: "Manual recorded",
      value: recorded.manual_paise,
      color: COLORS.manual,
    },
    {
      name: "Generated recurring",
      value: recorded.recurring_paise,
      color: COLORS.generated,
    },
    {
      name: "Upcoming scheduled",
      value: scheduled?.scheduled_paise ?? 0,
      color: COLORS.scheduled,
    },
  ].filter((item) => item.value > 0);

  const hasData =
    recorded.total_paise > 0 ||
    (scheduled?.scheduled_paise ?? 0) > 0;

  if (!hasData) {
    return (
      <ChartPanel
        title="Expense visualizations"
        description="Recorded and upcoming scheduled expenses."
      >
        <p className="py-8 text-center text-sm text-slate-500">
          No expenses to chart for this date range.
        </p>
      </ChartPanel>
    );
  }

  return (
    <div className="space-y-4">
      <ChartPanel
        title="Expense trend"
        description="Recorded amounts and upcoming scheduled amounts are shown separately."
      >
        {trendIsLimited && (
          <p className="mb-3 text-xs text-slate-500">
            Showing the latest 30 periods with activity. The tables
            below contain the complete selected date range.
          </p>
        )}

        <div className="overflow-x-auto">
          <div className="h-[340px] min-w-[620px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendPoints}
                margin={{ top: 12, right: 12, left: 8, bottom: 12 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke={COLORS.grid}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={65}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={axisMoney}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={55}
                />
                <Tooltip
                  formatter={(value) => formatTooltipAmount(value)}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.period ?? ""
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="manual"
                  name="Manual recorded"
                  stackId="expenses"
                  fill={COLORS.manual}
                />
                <Bar
                  dataKey="generated"
                  name="Generated recurring"
                  stackId="expenses"
                  fill={COLORS.generated}
                />
                <Bar
                  dataKey="scheduled"
                  name="Upcoming scheduled"
                  stackId="expenses"
                  fill={COLORS.scheduled}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Top expense categories"
          description="Five largest categories by recorded plus scheduled amount."
        >
          <div className="overflow-x-auto">
            <div className="h-[300px] min-w-[480px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCategories}
                  layout="vertical"
                  margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={COLORS.grid}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={axisMoney}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={135}
                    tick={{ fontSize: 11, fill: "#475569" }}
                  />
                  <Tooltip
                    formatter={(value) => formatTooltipAmount(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="recorded"
                    name="Recorded"
                    stackId="category"
                    fill={COLORS.manual}
                  />
                  <Bar
                    dataKey="scheduled"
                    name="Upcoming scheduled"
                    stackId="category"
                    fill={COLORS.scheduled}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Expense composition"
          description="How recorded and upcoming scheduled amounts contribute to the projected total."
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={composition}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={64}
                  outerRadius={99}
                  paddingAngle={2}
                >
                  {composition.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatTooltipAmount(value)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}