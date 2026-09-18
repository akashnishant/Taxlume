import { useEffect, useState } from "react";
import {
  deleteCompanySignature,
  getCompany,
  getCompanySignatureDataUrl,
  updateCompany,
  uploadCompanySignature,
  type Company,
} from "../services/companyApi";
import {
  getPaymentDetails,
  updatePaymentDetails,
  uploadPaymentQr,
  type PaymentDetails,
} from "../services/paymentDetailsApi";
import { gstStates } from "../constants/gstStates";

export default function Settings() {
  const [company, setCompany] = useState<Company | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");

  const [saveError, setSaveError] = useState("");

  const [saveSuccess, setSaveSuccess] = useState("");

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(
    null,
  );

  const [isSavingPaymentDetails, setIsSavingPaymentDetails] = useState(false);

  const [paymentSaveError, setPaymentSaveError] = useState("");

  const [paymentSaveSuccess, setPaymentSaveSuccess] = useState("");

  const [isUploadingQr, setIsUploadingQr] = useState(false);

  const [qrError, setQrError] = useState("");

  const [qrSuccess, setQrSuccess] = useState("");

  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(
    null,
  );

  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  const [isDeletingSignature, setIsDeletingSignature] = useState(false);

  const [signatureError, setSignatureError] = useState("");

  const [signatureSuccess, setSignatureSuccess] = useState("");

  useEffect(() => {
    async function loadCompany() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getCompany();

        setCompany(response);

        if (response.signature_key) {
          const signatureDataUrl = await getCompanySignatureDataUrl();

          setSignaturePreviewUrl(signatureDataUrl);
        } else {
          setSignaturePreviewUrl(null);
        }
      } catch {
        setError("Unable to load company settings.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadCompany();
  }, []);

  useEffect(() => {
    async function loadPaymentDetails() {
      try {
        const response = await getPaymentDetails();

        setPaymentDetails(response);
      } catch {
        setPaymentDetails(null);
      }
    }

    void loadPaymentDetails();
  }, []);

  function updateField<K extends keyof Company>(field: K, value: Company[K]) {
    setCompany((currentCompany) =>
      currentCompany
        ? {
            ...currentCompany,
            [field]: value,
          }
        : currentCompany,
    );

    setSaveSuccess("");
  }

  function updatePaymentField<K extends keyof PaymentDetails>(
    field: K,
    value: PaymentDetails[K],
  ) {
    setPaymentDetails((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );

    setPaymentSaveSuccess("");
  }

  async function handleSave() {
    if (!company) {
      return;
    }

    if (!company.legal_name.trim()) {
      setSaveError("Legal Name is required.");
      return;
    }

    const selectedState = gstStates.find(
      (state) => state.code === company.state_code,
    );

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const updatedCompany = await updateCompany({
        legal_name: company.legal_name.trim(),

        trade_name: company.trade_name?.trim() || undefined,

        gstin: company.gstin?.trim() || undefined,

        pan: company.pan?.trim() || undefined,

        email: company.email?.trim() || undefined,

        phone: company.phone?.trim() || undefined,

        website: company.website?.trim() || undefined,

        address_line1: company.address_line1?.trim() || undefined,

        address_line2: company.address_line2?.trim() || undefined,

        city: company.city?.trim() || undefined,

        state: selectedState?.name || company.state || undefined,

        state_code: company.state_code?.trim() || undefined,

        pincode: company.pincode?.trim() || undefined,

        country: company.country || "India",

        currency_code: company.currency_code || "INR",

        financial_year_start_month: company.financial_year_start_month,
      });

      setCompany(updatedCompany);

      setSaveSuccess("Company settings saved successfully.");
    } catch {
      setSaveError(
        "Unable to save company settings. Please check the entered details.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSavePaymentDetails() {
    if (!paymentDetails) {
      return;
    }

    setIsSavingPaymentDetails(true);
    setPaymentSaveError("");
    setPaymentSaveSuccess("");

    try {
      const updated = await updatePaymentDetails({
        bank_name: paymentDetails.bank_name?.trim() || null,

        account_holder_name: paymentDetails.account_holder_name?.trim() || null,

        account_number: paymentDetails.account_number?.trim() || null,

        ifsc_code: paymentDetails.ifsc_code?.trim().toUpperCase() || null,

        branch_name: paymentDetails.branch_name?.trim() || null,

        upi_id: paymentDetails.upi_id?.trim() || null,

        show_qr_on_invoice: paymentDetails.show_qr_on_invoice,
      });

      setPaymentDetails(updated);

      setPaymentSaveSuccess("Payment details saved successfully.");
    } catch {
      setPaymentSaveError("Unable to save payment details.");
    } finally {
      setIsSavingPaymentDetails(false);
    }
  }

  async function handleQrUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !paymentDetails) {
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setQrError("QR code must be a PNG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setQrError("QR code image must not exceed 2 MB.");
      event.target.value = "";
      return;
    }

    if (!paymentDetails.id) {
      setQrError("Please save Payment Details before uploading a QR code.");
      event.target.value = "";
      return;
    }

    setIsUploadingQr(true);
    setQrError("");
    setQrSuccess("");

    try {
      const response = await uploadPaymentQr(file);

      setPaymentDetails((current) =>
        current
          ? {
              ...current,
              qr_code_key: response.qr_code_key,
            }
          : current,
      );

      setQrSuccess("Payment QR code uploaded successfully.");
    } catch {
      setQrError("Unable to upload the payment QR code.");
    } finally {
      setIsUploadingQr(false);
      event.target.value = "";
    }
  }

  async function handleSignatureUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setSignatureError("Signature must be a PNG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSignatureError("Signature image must not exceed 2 MB.");
      event.target.value = "";
      return;
    }

    setIsUploadingSignature(true);
    setSignatureError("");
    setSignatureSuccess("");

    try {
      const response = await uploadCompanySignature(file);

      setCompany((current) =>
        current
          ? {
              ...current,
              signature_key: response.signature_key,
            }
          : current,
      );

      const signatureDataUrl = await getCompanySignatureDataUrl();

      setSignaturePreviewUrl(signatureDataUrl);

      setSignatureSuccess("Authorized signature uploaded successfully.");
    } catch {
      setSignatureError("Unable to upload the authorized signature.");
    } finally {
      setIsUploadingSignature(false);
      event.target.value = "";
    }
  }

  async function handleSignatureDelete() {
    if (!company?.signature_key) {
      return;
    }

    const confirmed = window.confirm("Remove the authorized signature?");

    if (!confirmed) {
      return;
    }

    setIsDeletingSignature(true);
    setSignatureError("");
    setSignatureSuccess("");

    try {
      await deleteCompanySignature();

      setCompany((current) =>
        current
          ? {
              ...current,
              signature_key: null,
            }
          : current,
      );

      setSignaturePreviewUrl(null);

      setSignatureSuccess("Authorized signature removed successfully.");
    } catch {
      setSignatureError("Unable to remove the authorized signature.");
    } finally {
      setIsDeletingSignature(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-slate-500">Loading company settings...</p>
      </main>
    );
  }

  if (error || !company) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Company settings not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage your company and billing settings.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Company Details
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Legal Name
            </label>

            <input
              type="text"
              value={company.legal_name}
              onChange={(event) =>
                updateField("legal_name", event.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Trade Name
            </label>

            <input
              type="text"
              value={company.trade_name ?? ""}
              onChange={(event) =>
                updateField("trade_name", event.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              GSTIN
            </label>

            <input
              type="text"
              maxLength={15}
              value={company.gstin ?? ""}
              onChange={(event) =>
                updateField("gstin", event.target.value.toUpperCase())
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              PAN
            </label>

            <input
              type="text"
              maxLength={10}
              value={company.pan ?? ""}
              onChange={(event) =>
                updateField("pan", event.target.value.toUpperCase())
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              type="email"
              value={company.email ?? ""}
              onChange={(event) => updateField("email", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Phone
            </label>

            <input
              type="text"
              value={company.phone ?? ""}
              onChange={(event) => updateField("phone", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Address Line 1
            </label>

            <input
              type="text"
              value={company.address_line1 ?? ""}
              onChange={(event) =>
                updateField("address_line1", event.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Address Line 2
            </label>

            <input
              type="text"
              value={company.address_line2 ?? ""}
              onChange={(event) =>
                updateField("address_line2", event.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              City
            </label>

            <input
              type="text"
              value={company.city ?? ""}
              onChange={(event) => updateField("city", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              State
            </label>

            <select
              value={company.state_code ?? ""}
              onChange={(event) => {
                const stateCode = event.target.value;

                const selectedState = gstStates.find(
                  (state) => state.code === stateCode,
                );

                setCompany((currentCompany) =>
                  currentCompany
                    ? {
                        ...currentCompany,
                        state_code: stateCode || null,
                        state: selectedState?.name ?? null,
                      }
                    : currentCompany,
                );

                setSaveSuccess("");
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="">Select state</option>

              {gstStates.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code} - {state.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Pincode
            </label>

            <input
              type="text"
              value={company.pincode ?? ""}
              onChange={(event) => updateField("pincode", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Country
            </label>

            <input
              type="text"
              value={company.country ?? ""}
              onChange={(event) => updateField("country", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {saveError && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {saveSuccess}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !company.legal_name.trim()}
            className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Company Details"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Authorized Signature
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Upload the authorized signature that should appear on invoices and
            other billing documents.
          </p>
        </div>

        <div className="mt-6">
          <label
            htmlFor="company-signature"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Signature Image
          </label>

          <div className="rounded-lg border border-dashed border-slate-300 p-4">
            <input
              id="company-signature"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleSignatureUpload}
              disabled={isUploadingSignature || isDeletingSignature}
              className="block w-full text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <p className="mt-2 text-xs text-slate-500">
              PNG, JPEG or WebP. Maximum file size 2 MB. A transparent PNG is
              recommended for the best invoice appearance.
            </p>

            {isUploadingSignature && (
              <p className="mt-3 text-sm text-slate-500">
                Uploading signature...
              </p>
            )}

            {company.signature_key && (
              <div className="mt-4">
                <p className="text-xs font-medium text-emerald-600">
                  Authorized signature is currently configured.
                </p>

                {signaturePreviewUrl && (
                  <div className="mt-3 inline-flex min-h-24 min-w-48 items-center justify-center rounded-md border border-slate-200 bg-white p-3">
                    <img
                      src={signaturePreviewUrl}
                      alt="Authorized signature preview"
                      className="max-h-20 max-w-56 object-contain"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleSignatureDelete}
                    disabled={isDeletingSignature || isUploadingSignature}
                    className="cursor-pointer rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeletingSignature ? "Removing..." : "Remove Signature"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {signatureError && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {signatureError}
          </div>
        )}

        {signatureSuccess && (
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {signatureSuccess}
          </div>
        )}
      </section>

      {paymentDetails && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Bank & Payment Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These details can be displayed on invoices and other billing
              documents.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Bank Name
              </label>

              <input
                type="text"
                value={paymentDetails.bank_name ?? ""}
                onChange={(event) =>
                  updatePaymentField("bank_name", event.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Account Holder Name
              </label>

              <input
                type="text"
                value={paymentDetails.account_holder_name ?? ""}
                onChange={(event) =>
                  updatePaymentField("account_holder_name", event.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Account Number
              </label>

              <input
                type="text"
                value={paymentDetails.account_number ?? ""}
                onChange={(event) =>
                  updatePaymentField("account_number", event.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                IFSC Code
              </label>

              <input
                type="text"
                value={paymentDetails.ifsc_code ?? ""}
                onChange={(event) =>
                  updatePaymentField(
                    "ifsc_code",
                    event.target.value.toUpperCase(),
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Branch Name
              </label>

              <input
                type="text"
                value={paymentDetails.branch_name ?? ""}
                onChange={(event) =>
                  updatePaymentField("branch_name", event.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                UPI ID
              </label>

              <input
                type="text"
                value={paymentDetails.upi_id ?? ""}
                onChange={(event) =>
                  updatePaymentField("upi_id", event.target.value)
                }
                placeholder="example@upi"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={paymentDetails.show_qr_on_invoice}
                  onChange={(event) =>
                    updatePaymentField(
                      "show_qr_on_invoice",
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="text-sm font-medium text-slate-700">
                  Show payment QR code on invoice
                </span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="payment-qr"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Payment QR Code
              </label>

              <div className="rounded-lg border border-dashed border-slate-300 p-4">
                <input
                  id="payment-qr"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleQrUpload}
                  disabled={isUploadingQr}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                />

                <p className="mt-2 text-xs text-slate-500">
                  PNG, JPEG or WebP. Maximum file size 2 MB.
                </p>

                {paymentDetails.qr_code_key && (
                  <p className="mt-2 text-xs font-medium text-emerald-600">
                    QR code is currently configured.
                  </p>
                )}

                {isUploadingQr && (
                  <p className="mt-2 text-sm text-slate-500">
                    Uploading QR code...
                  </p>
                )}
              </div>
            </div>
          </div>

          {paymentSaveError && (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {paymentSaveError}
            </div>
          )}

          {paymentSaveSuccess && (
            <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {paymentSaveSuccess}
            </div>
          )}

          {qrError && (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {qrError}
            </div>
          )}

          {qrSuccess && (
            <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {qrSuccess}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSavePaymentDetails}
              disabled={isSavingPaymentDetails}
              className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingPaymentDetails ? "Saving..." : "Save Payment Details"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
