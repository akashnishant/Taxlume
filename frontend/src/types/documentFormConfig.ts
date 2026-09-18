import type { DocumentPartyOption } from "./documentParty";

export type DocumentFormMode =
  | "SALES"
  | "PURCHASE";

export type DocumentFormConfig = {
  mode: DocumentFormMode;
  title: string;
  description: string;
  partyLabel: string;
  partyPlaceholder: string;
  backPath: string;
  saveRedirectPath: string;
  documentType:
    | "TAX_INVOICE"
    | "PROFORMA_INVOICE"
    | "PURCHASE_ORDER"
    | "QUOTATION"
    | "DELIVERY_CHALLAN";
  parties: DocumentPartyOption[];
  isPartiesLoading: boolean;
  partyLoadError?: string;
};