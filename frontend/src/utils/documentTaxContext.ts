import type { DocumentFormMode } from "../types/documentFormConfig";
import type { DocumentPartyOption } from "../types/documentParty";

type CompanyTaxIdentity = {
  state_code: string | null;
  gstin: string | null;
};

export function getDocumentSupplierStateCode(
  mode: DocumentFormMode,
  company: CompanyTaxIdentity | null,
  party: DocumentPartyOption | null,
): string {
  if (mode === "PURCHASE") {
    return (
      party?.state_code ??
      party?.gstin?.slice(0, 2) ??
      ""
    );
  }

  return (
    company?.state_code ??
    company?.gstin?.slice(0, 2) ??
    ""
  );
}