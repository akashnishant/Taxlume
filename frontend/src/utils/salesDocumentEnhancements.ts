import type { PaymentTermsCode } from "../services/invoiceApi";

export type ShipToField =
  | "name"
  | "contact_person"
  | "gstin"
  | "phone"
  | "email"
  | "address_line1"
  | "address_line2"
  | "city"
  | "state"
  | "state_code"
  | "pincode"
  | "country";

export type SalesEnhancementForm = {
  dueDate: string;
  paymentTermsCode: PaymentTermsCode;
  paymentTermsCustom: string;
  customerPoNumber: string;
  referenceNumber: string;
  shipToSameAsBillTo: boolean;
  shipTo: Record<ShipToField, string>;
  additionalChargeLabel: string;
  additionalChargePaise: number;
  additionalChargeTaxable: boolean;
  additionalChargeGstRateBps: number;
};

export function emptyShipTo(): Record<ShipToField, string> {
  return {
    name: "",
    contact_person: "",
    gstin: "",
    phone: "",
    email: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    state_code: "",
    pincode: "",
    country: "India",
  };
}

export function addDays(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";

  const value = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime())) return "";

  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function dueDateForTerms(
  documentDate: string,
  code: PaymentTermsCode,
): string {
  if (code === "CUSTOM") return "";

  const days = code === "DUE_ON_RECEIPT" ? 0 : Number(code.slice(4));
  return addDays(documentDate, days);
}

export function newSalesEnhancementForm(
  documentDate: string,
): SalesEnhancementForm {
  return {
    dueDate: documentDate,
    paymentTermsCode: "DUE_ON_RECEIPT",
    paymentTermsCustom: "",
    customerPoNumber: "",
    referenceNumber: "",
    shipToSameAsBillTo: true,
    shipTo: emptyShipTo(),
    additionalChargeLabel: "",
    additionalChargePaise: 0,
    additionalChargeTaxable: false,
    additionalChargeGstRateBps: -1,
  };
}

export function validateSalesEnhancements(
  form: SalesEnhancementForm,
  documentDate: string,
): string | null {
  if (form.dueDate && form.dueDate < documentDate) {
    return "Due date cannot be before the document date.";
  }

  if (form.paymentTermsCode === "CUSTOM" && !form.paymentTermsCustom.trim()) {
    return "Please enter custom payment terms.";
  }

  if (
    !form.shipToSameAsBillTo &&
    (!form.shipTo.name.trim() || !form.shipTo.address_line1.trim())
  ) {
    return "Enter a Ship To recipient name and address.";
  }

  if (
    !Number.isSafeInteger(form.additionalChargePaise) ||
    form.additionalChargePaise < 0
  ) {
    return "Additional charge must be a valid non-negative amount.";
  }

  if (form.additionalChargePaise > 0 && !form.additionalChargeLabel.trim()) {
    return "Please enter a label for the additional charge.";
  }

  if (
    form.additionalChargePaise > 0 &&
    form.additionalChargeTaxable &&
    (
      !Number.isInteger(form.additionalChargeGstRateBps) ||
      form.additionalChargeGstRateBps < 0 ||
      form.additionalChargeGstRateBps > 10000
    )
  ) {
    return "Please select a valid additional charge GST rate.";
  }

  return null;
}

export function toSalesEnhancementRequest(form: SalesEnhancementForm) {
  const shippingFields = Object.keys(form.shipTo) as ShipToField[];

  return {
    payment_terms_code: form.paymentTermsCode,
    payment_terms_custom:
      form.paymentTermsCode === "CUSTOM"
        ? form.paymentTermsCustom.trim()
        : undefined,
    customer_po_number: form.customerPoNumber.trim() || undefined,
    ship_to_same_as_bill_to: form.shipToSameAsBillTo,
    ...(!form.shipToSameAsBillTo
      ? Object.fromEntries(
          shippingFields.map((field) => [
            `ship_to_${field}`,
            form.shipTo[field].trim() || undefined,
          ]),
        )
      : {}),
    additional_charge_label:
      form.additionalChargePaise > 0
        ? form.additionalChargeLabel.trim()
        : undefined,
    additional_charge_paise: form.additionalChargePaise,
    additional_charge_taxable:
      form.additionalChargePaise > 0 && form.additionalChargeTaxable,
    additional_charge_gst_rate_bps:
      form.additionalChargePaise > 0 && form.additionalChargeTaxable
        ? form.additionalChargeGstRateBps
        : 0,
  };
}

export function toSalesEnhancementUpdateRequest(
  form: SalesEnhancementForm,
) {
  const explicitShipTo =
    !form.shipToSameAsBillTo;

  return {
    payment_terms_code:
      form.paymentTermsCode,

    payment_terms_custom:
      form.paymentTermsCode === "CUSTOM"
        ? form.paymentTermsCustom.trim() || null
        : null,

    customer_po_number:
      form.customerPoNumber.trim() || null,

    ship_to_same_as_bill_to:
      form.shipToSameAsBillTo,

    ship_to_name:
      explicitShipTo
        ? form.shipTo.name.trim() || null
        : null,

    ship_to_contact_person:
      explicitShipTo
        ? form.shipTo.contact_person.trim() || null
        : null,

    ship_to_gstin:
      explicitShipTo
        ? form.shipTo.gstin.trim() || null
        : null,

    ship_to_phone:
      explicitShipTo
        ? form.shipTo.phone.trim() || null
        : null,

    ship_to_email:
      explicitShipTo
        ? form.shipTo.email.trim() || null
        : null,

    ship_to_address_line1:
      explicitShipTo
        ? form.shipTo.address_line1.trim() || null
        : null,

    ship_to_address_line2:
      explicitShipTo
        ? form.shipTo.address_line2.trim() || null
        : null,

    ship_to_city:
      explicitShipTo
        ? form.shipTo.city.trim() || null
        : null,

    ship_to_state:
      explicitShipTo
        ? form.shipTo.state.trim() || null
        : null,

    ship_to_state_code:
      explicitShipTo
        ? form.shipTo.state_code.trim() || null
        : null,

    ship_to_pincode:
      explicitShipTo
        ? form.shipTo.pincode.trim() || null
        : null,

    ship_to_country:
      explicitShipTo
        ? form.shipTo.country.trim() || null
        : null,

    additional_charge_label:
      form.additionalChargePaise > 0
        ? form.additionalChargeLabel.trim() || null
        : null,

    additional_charge_paise:
      form.additionalChargePaise,

    additional_charge_taxable:
      form.additionalChargePaise > 0 &&
      form.additionalChargeTaxable,

    additional_charge_gst_rate_bps:
      form.additionalChargePaise > 0 &&
      form.additionalChargeTaxable
        ? form.additionalChargeGstRateBps
        : 0,
  };
}

export type InvoicePreviewItem = {
  quantity: number;
  ratePaise: number;
  discountPaise: number;
  gstRateBps: number;
  cessRateBps: number;
};

export function calculateDocumentPreview(
  items: InvoicePreviewItem[],
  isIntraState: boolean,
  form?: SalesEnhancementForm,
) {
  const result = {
    grossPaise: 0,
    discountPaise: 0,
    taxablePaise: 0,
    gstPaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    cessPaise: 0,
    additionalChargePaise: form?.additionalChargePaise ?? 0,
    additionalChargeTaxPaise: 0,
    totalPaise: 0,
  };

  const addGst = (taxablePaise: number, rateBps: number) => {
    const safeRateBps = Math.max(0, rateBps);
    const gstPaise = Math.floor((taxablePaise * safeRateBps) / 10000);
    result.gstPaise += gstPaise;

    if (isIntraState && safeRateBps > 0) {
      const cgstRateBps = Math.floor(safeRateBps / 2);
      const cgstPaise = Math.floor((gstPaise * cgstRateBps) / safeRateBps);
      result.cgstPaise += cgstPaise;
      result.sgstPaise += gstPaise - cgstPaise;
    } else if (safeRateBps > 0) {
      result.igstPaise += gstPaise;
    }

    return gstPaise;
  };

  for (const item of items) {
    const quantityMilli = Math.round(item.quantity * 1000);
    const grossPaise = Math.floor((quantityMilli * item.ratePaise) / 1000);
    const discountPaise = Math.min(
      Math.max(0, item.discountPaise),
      grossPaise,
    );
    const taxablePaise = grossPaise - discountPaise;

    result.grossPaise += grossPaise;
    result.discountPaise += discountPaise;
    result.taxablePaise += taxablePaise;
    addGst(taxablePaise, item.gstRateBps);
    result.cessPaise += Math.floor(
      (taxablePaise * item.cessRateBps) / 10000,
    );
  }

  if (form && form.additionalChargePaise > 0 && form.additionalChargeTaxable) {
    result.taxablePaise += form.additionalChargePaise;
    result.additionalChargeTaxPaise = addGst(
      form.additionalChargePaise,
      form.additionalChargeGstRateBps,
    );
  }

  result.totalPaise =
    result.grossPaise -
    result.discountPaise +
    result.additionalChargePaise +
    result.gstPaise +
    result.cessPaise;

  return result;
}
