import type { DocumentPartyOption } from "../types/documentParty";

type PartyAddress = {
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  country: string;
  is_default: number;
};

type PartyLike = {
  id: string;
  display_name: string;
  legal_name?: string | null;
  gstin: string | null;
  email?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  payment_terms_days?: number;
  addresses?: PartyAddress[];
  state_code?: string | null;
};

export function toDocumentPartyOption(
  party: PartyLike,
): DocumentPartyOption {
  const addresses =
    party.addresses ?? [];

  const defaultAddress =
    addresses.find(
      (address) =>
        address.is_default === 1,
    ) ?? addresses[0];

  return {
    id: party.id,
    display_name:
      party.display_name,
    legal_name:
      party.legal_name ?? null,
    gstin:
      party.gstin,
    email:
      party.email ?? null,
    phone:
      party.phone ?? null,
    contact_person:
      party.contact_person ?? null,
    payment_terms_days:
      party.payment_terms_days,
    addresses,
    state_code:
      party.state_code ??
      defaultAddress?.state_code ??
      party.gstin?.slice(0, 2) ??
      null,
  };
}
