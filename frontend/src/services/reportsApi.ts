import api from "./api";

export type SalesRegisterSummary = {
  currency_code: string;
  document_count: number;
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  cess_paise: number;
  total_paise: number;
};

export type SalesRegisterDocument = {
  id: string;
  document_number: string;
  document_date: string;
  party_name: string | null;
  currency_code: string;
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  cess_paise: number;
  total_paise: number;
};

export type SalesRegisterResponse = {
  success: boolean;
  filters: {
    start_date: string;
    end_date: string;
  };
  summary_by_currency: SalesRegisterSummary[];
  documents: SalesRegisterDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export async function getReportRegister(
  reportType: "sales" | "purchase-orders",
  startDate: string,
  endDate: string,
  page: number,
): Promise<SalesRegisterResponse> {
  const response = await api.get<SalesRegisterResponse>(
    `/api/reports/${reportType}`,
    {
      params: {
        start_date: startDate,
        end_date: endDate,
        page,
      },
    },
  );

  return response.data;
}

export async function getSalesRegister(
  startDate: string,
  endDate: string,
  page: number,
): Promise<SalesRegisterResponse> {
  return getReportRegister("sales", startDate, endDate, page);
}

export type MonthlyTaxSummaryRow = {
  month: string;
  currency_code: string;
  document_count: number;
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  cess_paise: number;
  total_paise: number;
};

export type TaxSummaryResponse = {
  success: boolean;
  filters: {
    start_date: string;
    end_date: string;
  };
  monthly_by_currency: MonthlyTaxSummaryRow[];
};

export async function getTaxSummary(
  startDate: string,
  endDate: string,
): Promise<TaxSummaryResponse> {
  const response = await api.get<TaxSummaryResponse>(
    "/api/reports/tax-summary",
    {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    },
  );

  return response.data;
}