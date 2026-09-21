import type { ChangeEvent, HTMLInputTypeAttribute } from "react";

import { gstStates } from "../constants/gstStates";
import type { PaymentTermsCode } from "../services/invoiceApi";
import type { DocumentPartyOption } from "../types/documentParty";
import {
  dueDateForTerms,
  type SalesEnhancementForm,
  type ShipToField,
} from "../utils/salesDocumentEnhancements";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500";
const readOnlyClass =
  "w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 outline-none";
const labelClass = "mb-2 block text-sm font-medium text-slate-700";

const shipFields: Array<{
  field: ShipToField;
  label: string;
  required?: boolean;
  wide?: boolean;
  type?: HTMLInputTypeAttribute;
  maxLength?: number;
}> = [
  { field: "name", label: "Recipient / Business Name", required: true, wide: true, maxLength: 200 },
  { field: "contact_person", label: "Contact Person", maxLength: 200 },
  { field: "gstin", label: "GSTIN", maxLength: 15 },
  { field: "phone", label: "Phone", maxLength: 30 },
  { field: "email", label: "Email", type: "email", maxLength: 254 },
  { field: "address_line1", label: "Address Line 1", required: true, wide: true, maxLength: 300 },
  { field: "address_line2", label: "Address Line 2", wide: true, maxLength: 300 },
  { field: "city", label: "City", maxLength: 100 },
  { field: "pincode", label: "PIN Code", maxLength: 20 },
  { field: "country", label: "Country", maxLength: 100 },
];

function PartyPreview({ party }: { party: DocumentPartyOption | null }) {
  if (!party) {
    return <p className="text-sm text-slate-500">Select a customer to view the address.</p>;
  }

  const address =
    party.addresses?.find((item) => item.is_default === 1) ??
    party.addresses?.[0];

  return (
    <div className="space-y-1 break-words text-sm text-slate-700">
      <p className="font-semibold text-slate-900">
        {party.display_name || party.legal_name || "-"}
      </p>
      {party.contact_person && <p>Contact: {party.contact_person}</p>}
      <p>{address?.address_line1 || "No billing address saved"}</p>
      {address?.address_line2 && <p>{address.address_line2}</p>}
      <p>
        {[address?.city, address?.state, address?.pincode, address?.country]
          .filter(Boolean)
          .join(", ") || "-"}
      </p>
      <p>GSTIN: {party.gstin || "-"}</p>
      <p>{[party.phone, party.email].filter(Boolean).join(" | ") || "-"}</p>
    </div>
  );
}

export default function SalesInvoiceFields({
  value,
  onChange,
  documentDate,
  billTo,
}: {
  value: SalesEnhancementForm;
  onChange: (next: SalesEnhancementForm) => void;
  documentDate: string;
  billTo: DocumentPartyOption | null;
}) {
  const set = <K extends keyof SalesEnhancementForm>(
    key: K,
    next: SalesEnhancementForm[K],
  ) => onChange({ ...value, [key]: next });

  const setShip = (field: ShipToField, next: string) =>
    onChange({ ...value, shipTo: { ...value.shipTo, [field]: next } });

  function handleTerms(event: ChangeEvent<HTMLSelectElement>) {
    const code = event.target.value as PaymentTermsCode;
    onChange({
      ...value,
      paymentTermsCode: code,
      dueDate: code === "CUSTOM" ? value.dueDate : dueDateForTerms(documentDate, code),
    });
  }

  function handleShipState(stateCode: string) {
    const state = gstStates.find((item) => item.code === stateCode);
    onChange({
      ...value,
      shipTo: {
        ...value.shipTo,
        state: state?.name ?? "",
        state_code: state?.code ?? "",
      },
    });
  }

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Bill To &amp; Ship To</h2>
        <p className="mt-1 text-sm text-slate-500">
          Billing comes from the selected customer. Shipping can use the same or a separate address.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Bill To</h3>
            <PartyPreview party={billTo} />
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Ship To</h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={value.shipToSameAsBillTo}
                  onChange={(event) => set("shipToSameAsBillTo", event.target.checked)}
                />
                Same as Bill To
              </label>
            </div>

            {value.shipToSameAsBillTo ? (
              <div className="mt-3"><PartyPreview party={billTo} /></div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {shipFields.map(({ field, label, required, wide, type, maxLength }) => (
                  <label key={field} className={wide ? "sm:col-span-2" : ""}>
                    <span className={labelClass}>{label}{required ? " *" : ""}</span>
                    <input
                      type={type ?? "text"}
                      className={inputClass}
                      value={value.shipTo[field]}
                      maxLength={maxLength}
                      onChange={(event) => setShip(field, event.target.value)}
                    />
                  </label>
                ))}

                <label>
                  <span className={labelClass}>State</span>
                  <select
                    className={inputClass}
                    value={value.shipTo.state_code}
                    onChange={(event) => handleShipState(event.target.value)}
                  >
                    <option value="">Select state</option>
                    {gstStates.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.code} - {state.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className={labelClass}>GST State Code</span>
                  <input className={readOnlyClass} value={value.shipTo.state_code} readOnly />
                </label>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Additional Invoice Details</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className={labelClass}>Due Date</span>
            <input
              type="date"
              min={documentDate}
              className={inputClass}
              value={value.dueDate}
              onChange={(event) => set("dueDate", event.target.value)}
            />
          </label>

          <label>
            <span className={labelClass}>Payment Terms</span>
            <select className={inputClass} value={value.paymentTermsCode} onChange={handleTerms}>
              <option value="DUE_ON_RECEIPT">Due on Receipt</option>
              <option value="NET_7">Net 7</option>
              <option value="NET_15">Net 15</option>
              <option value="NET_30">Net 30</option>
              <option value="NET_45">Net 45</option>
              <option value="NET_60">Net 60</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>

          <label>
            <span className={labelClass}>Customer PO Number</span>
            <input
              className={inputClass}
              value={value.customerPoNumber}
              maxLength={100}
              onChange={(event) => set("customerPoNumber", event.target.value)}
            />
          </label>

          <label>
            <span className={labelClass}>Reference Number</span>
            <input
              className={inputClass}
              value={value.referenceNumber}
              maxLength={100}
              onChange={(event) => set("referenceNumber", event.target.value)}
            />
          </label>

          {value.paymentTermsCode === "CUSTOM" && (
            <label className="md:col-span-2 lg:col-span-4">
              <span className={labelClass}>Custom Payment Terms *</span>
              <textarea
                className={inputClass}
                rows={2}
                maxLength={500}
                value={value.paymentTermsCustom}
                onChange={(event) => set("paymentTermsCustom", event.target.value)}
                placeholder="e.g. 50% advance, balance within 15 days"
              />
            </label>
          )}
        </div>
      </section>
    </>
  );
}

export function SalesChargeEditor({
  value,
  onChange,
}: {
  value: SalesEnhancementForm;
  onChange: (next: SalesEnhancementForm) => void;
}) {
  const set = <K extends keyof SalesEnhancementForm>(
    key: K,
    next: SalesEnhancementForm[K],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Additional Charge</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelClass}>Charge Description</span>
          <input
            className={inputClass}
            placeholder="e.g. Delivery Charge"
            maxLength={100}
            value={value.additionalChargeLabel}
            onChange={(event) => set("additionalChargeLabel", event.target.value)}
          />
        </label>

        <label>
          <span className={labelClass}>Amount (INR)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={value.additionalChargePaise / 100}
            onChange={(event) => {
              const rupees = Number(event.target.value);
              set(
                "additionalChargePaise",
                Number.isFinite(rupees) ? Math.max(0, Math.round(rupees * 100)) : 0,
              );
            }}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 pt-8 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value.additionalChargeTaxable}
            onChange={(event) =>
              onChange({
                ...value,
                additionalChargeTaxable: event.target.checked,
                additionalChargeGstRateBps: event.target.checked
                  ? value.additionalChargeGstRateBps
                  : -1,
              })
            }
          />
          Taxable charge
        </label>

        {value.additionalChargeTaxable && (
          <label>
            <span className={labelClass}>Charge GST Rate</span>
            <select
              className={inputClass}
              value={value.additionalChargeGstRateBps}
              onChange={(event) => set("additionalChargeGstRateBps", Number(event.target.value))}
            >
              <option value={-1} disabled>Select GST rate</option>
              <option value={0}>0%</option>
              <option value={25}>0.25%</option>
              <option value={150}>1.5%</option>
              <option value={300}>3%</option>
              <option value={500}>5%</option>
              <option value={1200}>12%</option>
              <option value={1800}>18%</option>
              <option value={2800}>28%</option>
            </select>
          </label>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Taxable charges enter the taxable value and use the selected GST rate. Non-taxable charges only increase the total.
      </p>
    </div>
  );
}
