import api from "./api";

export type ExpensePaymentMethod =
  | "CASH"
  | "UPI"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "CARD"
  | "OTHER";

export type ExpenseSource = "MANUAL" | "RECURRING";

export type Expense = {
  id: string;
  expense_date: string;

  category_id: string;
  category_name?: string | null;
  parent_category_id?: string | null;
  parent_category_name?: string | null;

  vendor_id: string | null;
  vendor_name?: string | null;
  payee_name: string | null;

  description: string | null;
  notes?: string | null;

  amount_paise: number;
  currency_code: string;
  payment_method: ExpensePaymentMethod;
  reference_number: string | null;

  source: ExpenseSource;
  client_request_id?: string | null;

  created_at: string;
  updated_at: string;
};

export type ExpenseDetails = Expense & {
  category_name: string | null;
  parent_category_id: string | null;
  parent_category_name: string | null;
  vendor_name: string | null;
  notes: string | null;
  recurring_rule_id: string | null;
  recurring_occurrence_date: string | null;
  client_request_id: string | null;
  created_by: string;
  updated_by: string | null;
};
export type ExpensePagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type ExpenseListParams = {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
  category_id?: string;
  vendor_id?: string;
  payment_method?: ExpensePaymentMethod;
  source?: ExpenseSource;
  search?: string;
};

export type ExpenseListResult = {
  expenses: Expense[];
  pagination: ExpensePagination;
};

export type CreateExpenseRequest = {
  expense_date: string;
  category_id: string;
  amount_paise: number;
  payment_method: ExpensePaymentMethod;

  vendor_id?: string | null;
  payee_name?: string | null;
  description?: string | null;
  notes?: string | null;
  reference_number?: string | null;

  // Generate once for a submission and reuse for retries.
  client_request_id: string;
};

export async function getExpenses(
  params: ExpenseListParams = {},
): Promise<ExpenseListResult> {
  const response = await api.get<{
    success: boolean;
    expenses: Expense[];
    pagination: ExpensePagination;
  }>("/api/expenses", {
    params,
  });

  return {
    expenses: response.data.expenses,
    pagination: response.data.pagination,
  };
}

export async function createExpense(
  data: CreateExpenseRequest,
): Promise<Expense> {
  const response = await api.post<{
    success: boolean;
    expense: Expense;
  }>("/api/expenses", data);

  return response.data.expense;
}
export async function getExpense(id: string): Promise<ExpenseDetails> {
  const response = await api.get<{
    success: boolean;
    expense: ExpenseDetails;
  }>(`/api/expenses/${encodeURIComponent(id)}`);

  return response.data.expense;
}
export type UpdateExpenseRequest = Partial<
  Omit<CreateExpenseRequest, "client_request_id">
>;

export async function updateExpense(
  id: string,
  data: UpdateExpenseRequest,
): Promise<Expense> {
  const response = await api.put<{
    success: boolean;
    expense: Expense;
  }>(`/api/expenses/${encodeURIComponent(id)}`, data);

  return response.data.expense;
}
export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/api/expenses/${encodeURIComponent(id)}`);
}