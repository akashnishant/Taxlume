import type { Product } from "../services/productApi";
import type { DocumentFormMode } from "../types/documentFormConfig";

export function getDocumentProductRatePaise(
  product: Product,
  mode: DocumentFormMode,
): number {
  return mode === "PURCHASE"
    ? product.purchase_price_paise
    : product.selling_price_paise;
}