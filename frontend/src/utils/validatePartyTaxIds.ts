type PartyTaxIds = {
  gstin?: string | null;
  pan?: string | null;
  stateCode?: string | null;
  country?: string | null;
};

const GSTIN_FORMAT =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function validatePartyTaxIds({
  gstin,
  pan,
  stateCode,
  country,
}: PartyTaxIds): string | null {
  const normalizedGstin = gstin?.trim().toUpperCase() ?? "";
  const normalizedPan = pan?.trim().toUpperCase() ?? "";

  // Both identifiers are optional.
  if (normalizedGstin) {
    if (!GSTIN_FORMAT.test(normalizedGstin)) {
      return "GSTIN format is invalid. Enter a valid 15-character GSTIN.";
    }

    const isIndianAddress =
      (country?.trim() || "India").toLowerCase() === "india";

    if (
      isIndianAddress &&
      stateCode?.trim() &&
      normalizedGstin.slice(0, 2) !== stateCode.trim()
    ) {
      return "GSTIN state code does not match the address state code.";
    }
  }

  if (normalizedPan && !PAN_FORMAT.test(normalizedPan)) {
    return "PAN format is invalid. Enter a valid 10-character PAN.";
  }

  if (
    normalizedGstin &&
    normalizedPan &&
    normalizedGstin.slice(2, 12) !== normalizedPan
  ) {
    return "PAN does not match the PAN embedded in the GSTIN.";
  }

  return null;
}