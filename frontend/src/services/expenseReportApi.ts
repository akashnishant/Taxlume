import api from "./api";

export type ExpenseReportGranularity = "day" | "month" | "year";

export type ExpenseReportTotals = {
  currency_code: string;
  expense_count: number;
  total_paise: number;
  manual_paise: number;
  recurring_paise: number;
};

export type ExpenseReportPeriod = ExpenseReportTotals & {
  period: string;
};

export type ExpenseReportCategory = ExpenseReportTotals & {
  category_id: string;
  category_name: string;
  parent_category_id: string | null;
  parent_category_name: string | null;
};

export type ExpenseReportCurrency = ExpenseReportTotals & {
  periods: ExpenseReportPeriod[];
  categories: ExpenseReportCategory[];
};

export type ScheduledExpenseReportPeriod = {
  period: string;
  occurrence_count: number;
  scheduled_paise: number;
};

export type ScheduledExpenseReportCategory = {
  category_id: string;
  category_name: string;
  parent_category_id: string | null;
  parent_category_name: string | null;
  occurrence_count: number;
  scheduled_paise: number;
};

export type ScheduledExpenseReportCurrency = {
  currency_code: string;
  occurrence_count: number;
  scheduled_paise: number;
  periods: ScheduledExpenseReportPeriod[];
  categories: ScheduledExpenseReportCategory[];
};

export type ExpenseReport = {
  success: boolean;
  start_date: string;
  end_date: string;
  granularity: ExpenseReportGranularity;
  projection_as_of_date: string;
  currencies: ExpenseReportCurrency[];
  scheduled_currencies: ScheduledExpenseReportCurrency[];
};

export type ExpenseReportParams = {
  start_date: string;
  end_date: string;
  granularity: ExpenseReportGranularity;
};

export async function getExpenseReport(
  params: ExpenseReportParams,
): Promise<ExpenseReport> {
  const response = await api.get<ExpenseReport>(
    "/api/reports/expenses",
    { params },
  );

  return response.data;
}