import type { Invoice } from "../services/invoiceApi";

export function formatDocumentType(
  documentType: Invoice["document_type"],
): string {
  switch (documentType) {
    case "TAX_INVOICE":
      return "Tax Invoice";

    case "PROFORMA_INVOICE":
      return "Proforma Invoice";

    case "PURCHASE_ORDER":
      return "Purchase Order";

    case "QUOTATION":
      return "Quotation";

    case "DELIVERY_CHALLAN":
      return "Delivery Challan";

    default:
      return documentType;
  }
}

export function formatDocumentStatus(
  status: Invoice["status"],
): string {
  switch (status) {
    case "DRAFT":
      return "Draft";

    case "ISSUED":
      return "Issued";

    case "CANCELLED":
      return "Cancelled";

    default:
      return status;
  }
}

export function formatMoneyPaise(
  amountPaise: number,
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}