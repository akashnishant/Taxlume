export type DocumentPartyAddress = {
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  country: string;
  is_default: number;
};

export type DocumentPartyOption = {
  id: string;
  display_name: string;
  gstin: string | null;
  state_code: string | null;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  payment_terms_days?: number;
  addresses?: DocumentPartyAddress[];
};
