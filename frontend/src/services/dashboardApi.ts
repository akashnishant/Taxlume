import api from "./api";

export type DashboardRecentDocument = {
  id: string;
  document_number: string;
  document_date: string;
  party_name: string | null;
  status: string;
  currency_code: string;
  total_paise: number;
  amount_paid_paise: number;
};

export type DashboardSummary = {
  currency_code: string;
  total_sales_paise: number;
  total_purchases_paise: number;
  outstanding_sales_paise: number;
  this_month_sales_paise: number;
  this_month_purchases_paise: number;
  customer_count: number;
};

export type DashboardData = {
  summary: DashboardSummary;
  recent_sales: DashboardRecentDocument[];
  recent_purchases: DashboardRecentDocument[];
};

export async function getDashboardSummary(): Promise<DashboardData> {
  const response = await api.get<{
    success: boolean;
    summary: DashboardSummary;
    recent_sales: DashboardRecentDocument[];
    recent_purchases: DashboardRecentDocument[];
  }>("/api/dashboard/summary");

  return {
    summary: response.data.summary,
    recent_sales: response.data.recent_sales,
    recent_purchases: response.data.recent_purchases,
  };
}