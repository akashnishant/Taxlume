import api from "./api";

export type PaymentMethod =
  | "CASH"
  | "UPI"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "CARD"
  | "OTHER";

export type InvoiceReceipt = {
  id: string;
  amount_paise: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  status: "RECORDED" | "REVERSED";
  created_by: string;
  created_at: string;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
};

export type InvoicePaymentBalance = {
  id: string;
  document_number: string;
  status: string;
  currency_code: string;
  total_paise: number;
  amount_paid_paise: number;
  outstanding_paise: number;
};

export type InvoiceReceiptHistoryResponse = {
  success: boolean;
  invoice: InvoicePaymentBalance;
  receipts: InvoiceReceipt[];
};

export type RecordInvoicePaymentRequest = {
  client_request_id: string;
  amount_paise: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
};

export type RecordInvoicePaymentResponse = {
  success: boolean;
  message: string;
  already_recorded: boolean;
  invoice: InvoicePaymentBalance;
  receipt: InvoiceReceipt;
};

export async function getInvoiceReceiptHistory(
  invoiceId: string,
): Promise<InvoiceReceiptHistoryResponse> {
  const response = await api.get<InvoiceReceiptHistoryResponse>(
    `/api/documents/${invoiceId}/receipts`,
  );

  return response.data;
}

export async function recordInvoicePayment(
  invoiceId: string,
  payment: RecordInvoicePaymentRequest,
): Promise<RecordInvoicePaymentResponse> {
  const response = await api.post<RecordInvoicePaymentResponse>(
    `/api/documents/${invoiceId}/receipts`,
    payment,
  );

  return response.data;
}

export async function reverseInvoiceReceipt(
  invoiceId: string,
  receiptId: string,
  reason: string,
): Promise<RecordInvoicePaymentResponse> {
  const response = await api.patch<RecordInvoicePaymentResponse>(
    `/api/documents/${invoiceId}/receipts/${receiptId}/reverse`,
    { reason },
  );

  return response.data;
}