import api from "./api";

export type RecurringFrequency =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY";

export type RecurringPaymentMethod =
  | "CASH"
  | "UPI"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "CARD"
  | "OTHER";

export type RecurringExpenseRule = {
  id: string;
  name: string;
  category_id: string;
  category_name?: string | null;
  vendor_id: string | null;
  vendor_name?: string | null;
  payee_name: string | null;
  description: string | null;
  notes?: string | null;
  amount_paise: number;
  currency_code: string;
  payment_method: RecurringPaymentMethod;
  frequency: RecurringFrequency;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  last_run_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;

  // Additional details may be present in GET responses.
  created_by?: string;
  updated_by?: string | null;
};

export type RecurringExpensePagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type RecurringExpenseListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  frequency?: RecurringFrequency;
};

export type CreateRecurringExpenseRequest = {
  name: string;
  category_id: string;
  amount_paise: number;
  payment_method: RecurringPaymentMethod;
  frequency: RecurringFrequency;
  start_date: string;

  interval_count?: number;
  end_date?: string | null;
  vendor_id?: string | null;
  payee_name?: string | null;
  description?: string | null;
  notes?: string | null;
};

export type UpdateRecurringExpenseRequest =
  Partial<CreateRecurringExpenseRequest>;

export type RecurringExpenseListResult = {
  recurring_expenses: RecurringExpenseRule[];
  pagination: RecurringExpensePagination;
};

export async function getRecurringExpenses(
  params: RecurringExpenseListParams = {},
): Promise<RecurringExpenseListResult> {
  const response = await api.get<{
    success: boolean;
    recurring_expenses: RecurringExpenseRule[];
    pagination: RecurringExpensePagination;
  }>("/api/recurring-expenses", {
    params,
  });

  return {
    recurring_expenses: response.data.recurring_expenses,
    pagination: response.data.pagination,
  };
}

export async function getRecurringExpense(
  id: string,
): Promise<RecurringExpenseRule> {
  const response = await api.get<{
    success: boolean;
    recurring_expense: RecurringExpenseRule;
  }>(`/api/recurring-expenses/${encodeURIComponent(id)}`);

  return response.data.recurring_expense;
}

export async function createRecurringExpense(
  data: CreateRecurringExpenseRequest,
): Promise<RecurringExpenseRule> {
  const response = await api.post<{
    success: boolean;
    recurring_expense: RecurringExpenseRule;
  }>("/api/recurring-expenses", data);

  return response.data.recurring_expense;
}

export async function updateRecurringExpense(
  id: string,
  data: UpdateRecurringExpenseRequest,
): Promise<RecurringExpenseRule> {
  const response = await api.put<{
    success: boolean;
    recurring_expense: RecurringExpenseRule;
  }>(
    `/api/recurring-expenses/${encodeURIComponent(id)}`,
    data,
  );

  return response.data.recurring_expense;
}

export async function setRecurringExpenseActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  await api.patch(
    `/api/recurring-expenses/${encodeURIComponent(id)}/status`,
    {
      is_active: isActive,
    },
  );
}

export async function deleteRecurringExpense(
  id: string,
): Promise<void> {
  await api.delete(
    `/api/recurring-expenses/${encodeURIComponent(id)}`,
  );
}
