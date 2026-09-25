import api from "./api";

export const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_RECEIPT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type ExpenseAttachment = {
  id: string;
  expense_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_by: string;
  created_at: string;
};

function attachmentPath(
  expenseId: string,
  attachmentId?: string,
): string {
  const base = `/api/expenses/${encodeURIComponent(expenseId)}/attachments`;

  return attachmentId
    ? `${base}/${encodeURIComponent(attachmentId)}`
    : base;
}

export async function getExpenseAttachments(
  expenseId: string,
): Promise<ExpenseAttachment[]> {
  const response = await api.get<{
    success: boolean;
    attachments: ExpenseAttachment[];
  }>(attachmentPath(expenseId));

  return response.data.attachments;
}

export async function uploadExpenseAttachment(
  expenseId: string,
  file: File,
): Promise<ExpenseAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<{
    success: boolean;
    attachment: ExpenseAttachment;
  }>(attachmentPath(expenseId), formData, {
    // The shared API client defaults to application/json.
    // Let the browser set the multipart boundary for FormData.
    headers: {
      "Content-Type": undefined,
    },
  });

  return response.data.attachment;
}

export async function downloadExpenseAttachment(
  expenseId: string,
  attachmentId: string,
): Promise<Blob> {
  const response = await api.get<Blob>(
    attachmentPath(expenseId, attachmentId),
    {
      responseType: "blob",
    },
  );

  return response.data;
}

export async function deleteExpenseAttachment(
  expenseId: string,
  attachmentId: string,
): Promise<void> {
  await api.delete(attachmentPath(expenseId, attachmentId));
}