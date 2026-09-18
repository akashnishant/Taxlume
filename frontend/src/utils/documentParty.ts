import type { DocumentPartyOption } from "../types/documentParty";

type PartyAddress = {
  state_code: string | null;
  is_default: number;
};

type PartyLike = {
  id: string;
  display_name: string;
  gstin: string | null;

  /*
   * Detail endpoints return addresses,
   * but list endpoints may not.
   */
  addresses?: PartyAddress[];

  /*
   * Allows list endpoints to expose a
   * resolved state code directly later.
   */
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
    gstin: party.gstin,
    state_code:
      party.state_code ??
      defaultAddress?.state_code ??
      party.gstin?.slice(0, 2) ??
      null,
  };
}