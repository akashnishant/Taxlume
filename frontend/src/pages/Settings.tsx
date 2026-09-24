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
  deletePaymentQr,
  getPaymentDetails,
  updatePaymentDetails,
  uploadPaymentQr,
  type PaymentDetails,
} from "../services/paymentDetailsApi";
import { gstStates } from "../constants/gstStates";
import LoadingState from "../components/LoadingState";
import ButtonLoadingContent from "../components/ButtonLoadingContent";
import { useNotification } from "../hooks/useNotifications";
import { LoaderCircle } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Settings() {
  const notify = useNotification();

  const [company, setCompany] = useState<Company | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");

  const [saveError, setSaveError] = useState("");

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(
    null,
  );

  const [isSavingPaymentDetails, setIsSavingPaymentDetails] = useState(false);

  const [paymentSaveError, setPaymentSaveError] = useState("");

  const [isUploadingQr, setIsUploadingQr] = useState(false);

  const [isQrDeleteOpen, setIsQrDeleteOpen] = useState(false);
  const [isDeletingQr, setIsDeletingQr] = useState(false);
  const [qrDeleteError, setQrDeleteError] = useState("");

  const [qrError, setQrError] = useState("");

  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(
    null,
  );

  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  const [isDeletingSignature, setIsDeletingSignature] = useState(false);

  const [signatureError, setSignatureError] = useState("");

  const [isSignatureDeleteOpen, setIsSignatureDeleteOpen] = useState(false);

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
  }

  async function handleSave() {
    if (!company || isSaving) {
      return;
    }

    setSaveError("");

    if (!company.legal_name.trim()) {
      setSaveError("Legal Name is required.");
      return;
    }

    const selectedState = gstStates.find(
      (state) => state.code === company.state_code,
    );

    setIsSaving(true);
    setSaveError("");

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

      notify({
        type: "success",
        title: "Company details saved",
        description: "Your company settings have been updated successfully.",
      });
    } catch {
      setSaveError(
        "Unable to save company settings. Please check the entered details.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSavePaymentDetails() {
    if (!paymentDetails || isSavingPaymentDetails) {
      return;
    }

    setIsSavingPaymentDetails(true);
    setPaymentSaveError("");

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

      notify({
        type: "success",
        title: "Payment details saved",
        description:
          "Your bank and payment settings have been updated successfully.",
      });
    } catch {
      setPaymentSaveError("Unable to save payment details.");
    } finally {
      setIsSavingPaymentDetails(false);
    }
  }

  function requestQrDelete() {
    if (
      !paymentDetails?.qr_code_key ||
      isUploadingQr ||
      isDeletingQr ||
      isSavingPaymentDetails
    ) {
      return;
    }

    setQrDeleteError("");
    setIsQrDeleteOpen(true);
  }

  async function handleQrDelete() {
    if (
      !isQrDeleteOpen ||
      !paymentDetails?.qr_code_key ||
      isUploadingQr ||
      isDeletingQr ||
      isSavingPaymentDetails
    ) {
      return;
    }

    setIsDeletingQr(true);
    setQrDeleteError("");

    try {
      await deletePaymentQr();

      setPaymentDetails((current) =>
        current
          ? {
              ...current,
              qr_code_key: null,
            }
          : current,
      );

      setIsQrDeleteOpen(false);

      notify({
        type: "success",
        title: "Payment QR code removed",
        description: "The QR code has been removed from your payment settings.",
      });
    } catch {
      setQrDeleteError(
        "Unable to remove the payment QR code. Please try again.",
      );
    } finally {
      setIsDeletingQr(false);
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

      notify({
        type: "success",
        title: "Payment QR code uploaded",
        description: "Your payment QR code has been saved successfully.",
      });
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

      // The upload has already succeeded. Fetching the preview is
      // a separate operation and should not turn a successful upload
      // into an apparent upload failure.
      try {
        const signatureDataUrl = await getCompanySignatureDataUrl();
        setSignaturePreviewUrl(signatureDataUrl);

        notify({
          type: "success",
          title: "Authorized signature uploaded",
          description: "Your signature has been saved successfully.",
        });
      } catch {
        setSignaturePreviewUrl(null);

        notify({
          type: "warning",
          title: "Authorized signature uploaded",
          description:
            "The signature was saved, but its preview could not be loaded. Refresh Settings to try loading the preview again.",
        });
      }
    } catch {
      setSignatureError("Unable to upload the authorized signature.");
    } finally {
      setIsUploadingSignature(false);
      event.target.value = "";
    }
  }

  function requestSignatureDelete() {
    if (
      !company?.signature_key ||
      isUploadingSignature ||
      isDeletingSignature
    ) {
      return;
    }

    setSignatureError("");
    setIsSignatureDeleteOpen(true);
  }

  async function handleSignatureDelete() {
    if (
      !isSignatureDeleteOpen ||
      !company?.signature_key ||
      isUploadingSignature ||
      isDeletingSignature
    ) {
      return;
    }

    setIsDeletingSignature(true);
    setSignatureError("");

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
      setIsSignatureDeleteOpen(false);

      notify({
        type: "success",
        title: "Authorized signature removed",
        description: "The signature has been removed from company settings.",
      });
    } catch {
      // Keep the dialog open so the user can read the error
      // and choose whether to retry or cancel.
      setSignatureError(
        "Unable to remove the authorized signature. Please try again.",
      );
    } finally {
      setIsDeletingSignature(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <LoadingState
          message="Loading settings..."
          description="Fetching your company details and authorized signature."
        />
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

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="cursor-pointer rounded-md bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
          >
            {isSaving ? (
              <ButtonLoadingContent message="Saving company details..." />
            ) : (
              "Save Company Details"
            )}
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
              <div
                role="status"
                className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600"
              >
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Uploading authorized signature...
              </div>
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
                    onClick={requestSignatureDelete}
                    disabled={isDeletingSignature || isUploadingSignature}
                    className="cursor-pointer rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
                  >
                    {isDeletingSignature ? (
                      <ButtonLoadingContent message="Removing signature..." />
                    ) : (
                      "Remove Signature"
                    )}
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
                  disabled={isUploadingQr || isDeletingQr}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                />

                <p className="mt-2 text-xs text-slate-500">
                  PNG, JPEG or WebP. Maximum file size 2 MB.
                </p>

                {paymentDetails.qr_code_key && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-emerald-600">
                      QR code is currently configured.
                    </p>

                    <button
                      type="button"
                      onClick={requestQrDelete}
                      disabled={
                        isUploadingQr || isDeletingQr || isSavingPaymentDetails
                      }
                      className="mt-3 inline-flex items-center justify-center rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDeletingQr ? (
                        <ButtonLoadingContent message="Removing QR code..." />
                      ) : (
                        "Remove QR Code"
                      )}
                    </button>
                  </div>
                )}

                {isUploadingQr && (
                  <div
                    role="status"
                    className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600"
                  >
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Uploading payment QR code...
                  </div>
                )}
              </div>
            </div>
          </div>

          {paymentSaveError && (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {paymentSaveError}
            </div>
          )}

          {qrError && (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {qrError}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSavePaymentDetails}
              disabled={isSavingPaymentDetails}
              className="cursor-pointer rounded-md bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
            >
              {isSavingPaymentDetails ? (
                <ButtonLoadingContent message="Saving payment details..." />
              ) : (
                "Save Payment Details"
              )}
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={isSignatureDeleteOpen}
        title="Remove authorized signature?"
        description={
          <>
            <p>
              Are you sure you want to remove the authorized signature from your
              company settings?
            </p>

            <p className="mt-2">
              It will no longer be available for newly prepared documents that
              use your current company settings.
            </p>

            {signatureError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {signatureError}
              </p>
            )}
          </>
        }
        confirmLabel="Remove signature"
        cancelLabel="Keep signature"
        tone="danger"
        isProcessing={isDeletingSignature}
        onConfirm={handleSignatureDelete}
        onCancel={() => {
          if (!isDeletingSignature) {
            setIsSignatureDeleteOpen(false);
          }
        }}
      />

      <ConfirmDialog
        open={isQrDeleteOpen}
        title="Remove payment QR code?"
        description={
          <>
            <p>
              Are you sure you want to remove the QR code from your company’s
              payment settings?
            </p>

            <p className="mt-2">
              You can upload a new QR code later. Removing this one will stop it
              from being used when preparing new documents.
            </p>

            {qrDeleteError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {qrDeleteError}
              </p>
            )}
          </>
        }
        confirmLabel="Remove QR code"
        cancelLabel="Keep QR code"
        tone="danger"
        isProcessing={isDeletingQr}
        onConfirm={handleQrDelete}
        onCancel={() => {
          if (!isDeletingQr) {
            setIsQrDeleteOpen(false);
            setQrDeleteError("");
          }
        }}
      />
    </main>
  );
}
