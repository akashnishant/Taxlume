import api from "./api";

export type AnalyticsMonth = {
  month: string;
  taxable_sales_paise: number;
  invoice_total_paise: number;
  recorded_receipts_paise: number;
};

export type AnalyticsDay = {
  date: string;
  taxable_sales_paise: number;
  invoice_total_paise: number;
  recorded_receipts_paise: number;
};

export type AnalyticsAgingBucket = {
  bucket:
    | "not_overdue"
    | "overdue_1_30"
    | "overdue_31_60"
    | "overdue_61_90"
    | "overdue_91_plus"
    | "no_due_date";
  label: string;
  invoice_count: number;
  amount_paise: number;
};

export type AnalyticsCollectionStatus = {
  bucket: "paid" | "partial" | "unpaid";
  label: string;
  invoice_count: number;
  invoice_total_paise: number;
  outstanding_paise: number;
};

export type AnalyticsTopCustomer = {
  party_id: string | null;
  customer_name: string;
  invoice_count: number;
  taxable_sales_paise: number;
  invoice_total_paise: number;
};

export type AnalyticsPaymentMethod = {
  payment_method: string;
  label: string;
  receipt_count: number;
  amount_paise: number;
};

export type AnalyticsOverview = {
  success: boolean;

  filters: {
    start_date: string;
    end_date: string;
    currency_code: string;
  };

  period_metrics: {
    invoice_count: number;
    taxable_sales_paise: number;
    invoice_total_paise: number;
    recorded_receipts_paise: number;
  };

  current_balances: {
    as_of_date: string;
    outstanding_paise: number;
    overdue_paise: number;
    no_due_date_paise: number;
  };

  monthly_trend: AnalyticsMonth[];
  daily_trend: AnalyticsDay[];
  receivables_aging: AnalyticsAgingBucket[];
  collection_status: AnalyticsCollectionStatus[];
  top_customers: AnalyticsTopCustomer[];
  collections_by_method: AnalyticsPaymentMethod[];
};

export async function getAnalyticsOverview(
  startDate: string,
  endDate: string,
): Promise<AnalyticsOverview> {
  const response = await api.get<AnalyticsOverview>(
    "/api/reports/overview",
    {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    },
  );

  return response.data;
}