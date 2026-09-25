import api from "./api";

export type ExpenseCategory = {
  id: string;
  name: string;
  parent_category_id: string | null;
  description: string | null;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type CreateExpenseCategoryRequest = {
  name: string;
  parent_category_id?: string | null;
  description?: string | null;
  display_order?: number;
};

export type UpdateExpenseCategoryRequest = {
  // The backend requires name for every update.
  name: string;
  parent_category_id?: string | null;
  description?: string | null;
  display_order?: number;
};

function categoryPath(id?: string): string {
  const base = "/api/expense-categories";

  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const response = await api.get<{
    success: boolean;
    categories: ExpenseCategory[];
  }>(categoryPath());

  return response.data.categories;
}

export async function getExpenseCategory(
  id: string,
): Promise<ExpenseCategory> {
  const response = await api.get<{
    success: boolean;
    category: ExpenseCategory;
  }>(categoryPath(id));

  return response.data.category;
}

export async function createExpenseCategory(
  data: CreateExpenseCategoryRequest,
): Promise<ExpenseCategory> {
  const response = await api.post<{
    success: boolean;
    category: ExpenseCategory;
  }>(categoryPath(), data);

  return response.data.category;
}

export async function updateExpenseCategory(
  id: string,
  data: UpdateExpenseCategoryRequest,
): Promise<ExpenseCategory> {
  const response = await api.put<{
    success: boolean;
    category: ExpenseCategory;
  }>(categoryPath(id), data);

  return response.data.category;
}

export async function setExpenseCategoryActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  await api.patch(`${categoryPath(id)}/status`, {
    is_active: isActive,
  });
}