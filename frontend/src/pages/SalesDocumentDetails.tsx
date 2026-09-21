import axios from "axios";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getDocumentSnapshotAssetDataUrl,
  getInvoice,
  updateDocumentStatus,
  type InvoiceDetails,
} from "../services/invoiceApi";
import { getCompany, getCompanySignatureDataUrl } from "../services/companyApi";
import {
  getPaymentDetails,
  getPaymentQrDataUrl,
} from "../services/paymentDetailsApi";
import LoadingState from "../components/LoadingState";
import ButtonLoadingContent from "../components/ButtonLoadingContent";
import ConfirmDialog from "../components/ConfirmDialog";
import { useNotification } from "../hooks/useNotifications";
import InvoicePaymentsPanel from "../components/InvoicePaymentsPanel";

function formatDocumentType(documentType: string): string {
  switch (documentType) {
    case "TAX_INVOICE":
      return "Tax Invoice";
    case "PROFORMA_INVOICE":
      return "Proforma Invoice";
    case "QUOTATION":
      return "Quotation";
    case "DELIVERY_CHALLAN":
      return "Delivery Challan";
    case "PURCHASE_ORDER":
      return "Purchase Order";
    default:
      return documentType;
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ISSUED":
      return "Issued";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function formatMoney(valuePaise: number): string {
  return `₹${(valuePaise / 100).toFixed(2)}`;
}

function formatPaymentTerms(
  code: string | null,
  custom: string | null,
): string {
  switch (code) {
    case "DUE_ON_RECEIPT":
      return "Due on Receipt";
    case "NET_7":
      return "Net 7";
    case "NET_15":
      return "Net 15";
    case "NET_30":
      return "Net 30";
    case "NET_45":
      return "Net 45";
    case "NET_60":
      return "Net 60";
    case "CUSTOM":
      return custom?.trim() || "Custom";
    default:
      return "-";
  }
}

function formatRateBps(
  rateBps: number,
): string {
  const percent =
    rateBps / 100;

  return Number.isInteger(percent)
    ? percent.toFixed(0)
    : percent.toFixed(2);
}

export default function SalesDocumentDetails() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { id } = useParams();
  const location = useLocation();

  const isPurchaseRoute = location.pathname.startsWith("/purchases/");

  const partyLabel = isPurchaseRoute ? "Vendor" : "Customer";

  const basePath = isPurchaseRoute ? "/purchases" : "/sales";

  const sectionLabel = isPurchaseRoute ? "Purchases" : "Sales";

  const documentLabel = isPurchaseRoute ? "purchase order" : "sales document";

  const [document, setDocument] = useState<InvoiceDetails | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [isIssuing, setIsIssuing] = useState(false);

  const [isCancelling, setIsCancelling] = useState(false);

  const [actionError, setActionError] = useState("");

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [pendingAction, setPendingAction] = useState<"ISSUE" | "CANCEL" | null>(
    null,
  );

  const [paymentHistory, setPaymentHistory] = useState<{
    invoiceId: string;
    hasReceipts: boolean | null;
  } | null>(null);

  const isIssuedTaxInvoice =
    document?.document_type === "TAX_INVOICE" && document.status === "ISSUED";

  const cancellationBlockedByHistory =
    isIssuedTaxInvoice &&
    !(
      paymentHistory?.invoiceId === document?.id &&
      paymentHistory.hasReceipts === false
    );

  const cancellationHasReceipts =
    isIssuedTaxInvoice &&
    paymentHistory?.invoiceId === document?.id &&
    paymentHistory.hasReceipts === true;

  useEffect(() => {
    async function loadDocument() {
      if (!id) {
        setError("Document ID is missing.");
        setIsLoading(false);
        return;
      }

      setPaymentHistory(null);
      setIsLoading(true);
      setError("");

      try {
        const response = await getInvoice(id);

        setDocument(response);
      } catch {
        setError(`Unable to load the ${documentLabel}.`);
      } finally {
        setIsLoading(false);
      }
    }

    void loadDocument();
  }, [id]);

  function requestIssue() {
    if (
      !document ||
      document.status !== "DRAFT" ||
      isIssuing ||
      isCancelling ||
      isGeneratingPdf
    ) {
      return;
    }

    setActionError("");
    setPendingAction("ISSUE");
  }

  function requestCancel() {
    if (
      !document ||
      document.status !== "ISSUED" ||
      isIssuing ||
      isCancelling ||
      isGeneratingPdf ||
      cancellationBlockedByHistory
    ) {
      return;
    }

    setActionError("");
    setPendingAction("CANCEL");
  }

  function closeActionDialog() {
    if (isIssuing || isCancelling) return;

    setPendingAction(null);
    setActionError("");
  }

  async function handleIssue() {
    if (!document || document.status !== "DRAFT") {
      return;
    }

    if (
      !document ||
      document.status !== "DRAFT" ||
      pendingAction !== "ISSUE" ||
      isIssuing ||
      isCancelling ||
      isGeneratingPdf
    ) {
      return;
    }

    setIsIssuing(true);
    setActionError("");

    try {
      const statusResponse =
        await updateDocumentStatus(
          document.id,
          "ISSUED",
        );

      let issuedDocumentNumber =
        statusResponse.document_number;

      setDocument((currentDocument) =>
        currentDocument
          ? {
              ...currentDocument,
              document_number:
                statusResponse.document_number,
              status: "ISSUED",
            }
          : currentDocument,
      );

      /*
       * Issuance already succeeded at this point.
       * Refresh best-effort so immutable snapshot data is
       * immediately used by the Details page.
       *
       * A refresh failure must not incorrectly tell the
       * user that issuance itself failed.
       */
      try {
        const refreshedDocument =
          await getInvoice(document.id);

        setDocument(
          refreshedDocument,
        );

        issuedDocumentNumber =
          refreshedDocument.document_number;
      } catch {
        // Keep the successful status response state.
      }

      setPendingAction(null);

      notify({
        type: "success",
        title:
          "Document issued successfully",
        description:
          `${issuedDocumentNumber} has been issued and can no longer be edited.`,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const responseData =
          error.response?.data as
            | {
                message?: string;
                errors?: string[];
              }
            | undefined;

        if (
          responseData?.errors &&
          responseData.errors.length > 0
        ) {
          setActionError(
            responseData.errors.join(" "),
          );
          return;
        }

        if (responseData?.message) {
          setActionError(
            responseData.message,
          );
          return;
        }
      }

      setActionError(
        "Unable to issue the document. Please try again.",
      );
    } finally {
      setIsIssuing(false);
    }
  }

  async function handleCancel() {
    if (!document || document.status !== "ISSUED") {
      return;
    }

    if (
      !document ||
      document.status !== "ISSUED" ||
      pendingAction !== "CANCEL" ||
      isIssuing ||
      isCancelling ||
      isGeneratingPdf ||
      cancellationBlockedByHistory
    ) {
      return;
    }

    setIsCancelling(true);
    setActionError("");

    try {
      await updateDocumentStatus(document.id, "CANCELLED");

      setDocument((currentDocument) =>
        currentDocument
          ? {
              ...currentDocument,
              status: "CANCELLED",
            }
          : currentDocument,
      );

      setPendingAction(null);

      notify({
        type: "success",
        title: "Document cancelled successfully",
        description: `${document.document_number} has been marked as cancelled.`,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
          | {
              message?: string;
              errors?: string[];
            }
          | undefined;

        if (responseData?.errors && responseData.errors.length > 0) {
          setActionError(responseData.errors.join(" "));
          return;
        }

        if (responseData?.message) {
          setActionError(responseData.message);
          return;
        }
      }

      setActionError("Unable to cancel the document. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleDownloadPdf() {
    if (!document || isGeneratingPdf || isIssuing || isCancelling) {
      return;
    }

    setIsGeneratingPdf(true);
    setActionError("");

    try {
      let company;
      let paymentDetails;
      let pdfDocument = document;
      let paymentQrDataUrl: string | null = null;
      let signatureDataUrl: string | null = null;

      if (document.snapshot) {
        const snapshot = document.snapshot;

        company = {
          legal_name: snapshot.company.legal_name,
          trade_name: snapshot.company.trade_name,
          gstin: snapshot.company.gstin,
          pan: snapshot.company.pan,
          email: snapshot.company.email,
          phone: snapshot.company.phone,
          address_line1: snapshot.company.address_line1,
          address_line2: snapshot.company.address_line2,
          city: snapshot.company.city,
          state: snapshot.company.state,
          pincode: snapshot.company.pincode,
          country: snapshot.company.country,
        };

        paymentDetails = {
          bank_name: snapshot.payment?.bank_name ?? null,
          account_holder_name: snapshot.payment?.account_holder_name ?? null,
          account_number: snapshot.payment?.account_number ?? null,
          ifsc_code: snapshot.payment?.ifsc_code ?? null,
          branch_name: snapshot.payment?.branch_name ?? null,
          upi_id: snapshot.payment?.upi_id ?? null,
          show_qr_on_invoice: snapshot.payment?.show_qr_on_invoice ?? false,
        };

        if (snapshot.party) {
          pdfDocument = {
            ...document,
            party: {
              id: snapshot.party.id,
              display_name: snapshot.party.display_name,
              legal_name: snapshot.party.legal_name,
              gstin: snapshot.party.gstin,
              pan: snapshot.party.pan,
              email: snapshot.party.email,
              phone: snapshot.party.phone,
              addresses: snapshot.party.addresses.map((address, index) => ({
                id: `${document.id}-snapshot-address-${index}`,
                address_type: address.address_type,
                label: address.label,
                address_line1: address.address_line1,
                address_line2: address.address_line2,
                city: address.city,
                state: address.state,
                state_code: address.state_code,
                pincode: address.pincode,
                country: address.country,
                is_default: address.is_default ? 1 : 0,
              })),
            },
          };
        } else {
          pdfDocument = {
            ...document,
            party: null,
          };
        }

        [paymentQrDataUrl, signatureDataUrl] = await Promise.all([
          snapshot.has_payment_qr
            ? getDocumentSnapshotAssetDataUrl(document.id, "payment-qr")
            : Promise.resolve(null),

          snapshot.has_signature && document.status === "ISSUED"
            ? getDocumentSnapshotAssetDataUrl(document.id, "signature")
            : Promise.resolve(null),
        ]);
      } else {
        [company, paymentDetails] = await Promise.all([
          getCompany(),
          getPaymentDetails(),
        ]);

        [paymentQrDataUrl, signatureDataUrl] = await Promise.all([
          paymentDetails.show_qr_on_invoice && paymentDetails.qr_code_key
            ? getPaymentQrDataUrl()
            : Promise.resolve(null),

          company.signature_key && document.status === "ISSUED"
            ? getCompanySignatureDataUrl()
            : Promise.resolve(null),
        ]);
      }

      const [{ pdf }, { default: InvoicePdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../pdf/InvoicePdfDocument"),
      ]);

      const blob = await pdf(
        <InvoicePdfDocument
          company={company}
          document={pdfDocument}
          paymentDetails={paymentDetails}
          paymentQrDataUrl={paymentQrDataUrl}
          signatureDataUrl={signatureDataUrl}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);

      const link = window.document.createElement("a");

      link.href = url;
      link.download = `${document.document_number}.pdf`;

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch {
      setActionError("Unable to generate the PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <LoadingState
          message={`Loading ${documentLabel}...`}
          description="Fetching the document details and latest status."
        />
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate(basePath)}
          className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to {sectionLabel}
        </button>

        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Document not found."}
        </div>
      </main>
    );
  }

  const isInterState = document.totals.igst_paise > 0;

  const displayParty = document.snapshot?.party
    ? {
        id: document.snapshot.party.id,
        display_name: document.snapshot.party.display_name,
        legal_name: document.snapshot.party.legal_name,
        gstin: document.snapshot.party.gstin,
        pan: document.snapshot.party.pan,
        email: document.snapshot.party.email,
        phone: document.snapshot.party.phone,
        addresses: document.snapshot.party.addresses.map((address, index) => ({
          id: `${document.id}-snapshot-address-${index}`,
          address_type: address.address_type,
          label: address.label,
          address_line1: address.address_line1,
          address_line2: address.address_line2,
          city: address.city,
          state: address.state,
          state_code: address.state_code,
          pincode: address.pincode,
          country: address.country,
          is_default: address.is_default ? 1 : 0,
        })),
      }
    : document.party;

  const billToAddress =
    displayParty?.addresses.find(
      (address) =>
        address.is_default === 1,
    ) ??
    displayParty?.addresses[0] ??
    null;

  /*
   * Legacy invoices have NULL for same_as_bill_to.
   * Treat NULL as "same" for display only.
   * No database mutation occurs.
   */
  const shipToSameAsBillTo =
    document.ship_to.same_as_bill_to !== false;

  const paymentTermsLabel =
    formatPaymentTerms(
      document.payment_terms.code,
      document.payment_terms.custom,
    );

  const balanceDuePaise =
    Math.max(
      0,
      document.totals.total_paise -
        document.totals.amount_paid_paise,
    );


  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <button
        type="button"
        onClick={() => navigate(basePath)}
        className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to {sectionLabel}
      </button>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-slate-100 p-2 text-slate-600">
              <FileText size={20} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {document.document_number}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {formatDocumentType(document.document_type)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              document.status === "DRAFT"
                ? "bg-amber-50 text-amber-700"
                : document.status === "ISSUED"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {formatStatus(document.status)}
          </span>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || isIssuing || isCancelling}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <ButtonLoadingContent message="Generating PDF..." />
            ) : (
              <>
                <Download size={16} />
                Download PDF
              </>
            )}
          </button>

          {document.status === "DRAFT" && (
            <>
              <button
                type="button"
                onClick={() => navigate(`${basePath}/${document.id}/edit`)}
                disabled={isIssuing}
                className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Edit Draft
              </button>

              <button
                type="button"
                onClick={requestIssue}
                disabled={isIssuing || isCancelling || isGeneratingPdf}
                className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isIssuing ? (
                  <ButtonLoadingContent message="Issuing document..." />
                ) : (
                  "Issue Document"
                )}
              </button>
            </>
          )}

          {document.status === "ISSUED" && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={requestCancel}
                disabled={
                  isIssuing ||
                  isCancelling ||
                  isGeneratingPdf ||
                  cancellationBlockedByHistory
                }
                className="cursor-pointer rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancelling ? (
                  <ButtonLoadingContent message="Cancelling document..." />
                ) : (
                  "Cancel Document"
                )}
              </button>

              {cancellationBlockedByHistory && (
                <p className="max-w-xs text-right text-xs text-slate-500">
                  {cancellationHasReceipts
                    ? "Cancellation is unavailable because this invoice has payment history, including any reversed receipts."
                    : "Checking payment history before cancellation. If it cannot be loaded, use Try again in Customer Payments."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Document Details
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Document Date
              </p>

              <p className="mt-1 text-sm font-medium text-slate-900">
                {document.document_date}
              </p>
            </div>

            {!isPurchaseRoute && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Due Date
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {document.due_date ?? "-"}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Place of Supply
              </p>

              <p className="mt-1 text-sm font-medium text-slate-900">
                {document.place_of_supply.state_code
                  ? `${document.place_of_supply.state_code} - `
                  : ""}
                {document.place_of_supply.state ?? "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Currency
              </p>

              <p className="mt-1 text-sm font-medium text-slate-900">
                {document.currency_code}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Reference Number
              </p>

              <p className="mt-1 break-words text-sm font-medium text-slate-900">
                {document.reference_number ?? "-"}
              </p>
            </div>

            {!isPurchaseRoute && (
              <>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Payment Terms
                  </p>

                  <p className="mt-1 break-words text-sm font-medium text-slate-900">
                    {paymentTermsLabel}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Customer PO Number
                  </p>

                  <p className="mt-1 break-words text-sm font-medium text-slate-900">
                    {document.customer_po_number ?? "-"}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {!isPurchaseRoute ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Bill To &amp; Ship To
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bill To
                </h3>

                {displayParty ? (
                  <div className="mt-4 space-y-1 break-words text-sm leading-6 text-slate-600">
                    <p className="font-semibold text-slate-900">
                      {displayParty.display_name ??
                        displayParty.legal_name ??
                        "-"}
                    </p>

                    <p>
                      GSTIN: {displayParty.gstin ?? "-"}
                    </p>

                    <p>
                      Phone: {displayParty.phone ?? "-"}
                    </p>

                    <p>
                      Email: {displayParty.email ?? "-"}
                    </p>

                    <div className="pt-2">
                      {billToAddress ? (
                        <>
                          <p>
                            {billToAddress.address_line1 || "-"}
                          </p>

                          {billToAddress.address_line2 && (
                            <p>{billToAddress.address_line2}</p>
                          )}

                          <p>
                            {[
                              billToAddress.city,
                              billToAddress.state,
                              billToAddress.pincode,
                              billToAddress.country,
                            ]
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </p>
                        </>
                      ) : (
                        <p>-</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No customer attached.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ship To
                  </h3>

                  {shipToSameAsBillTo && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      Same as Bill To
                    </span>
                  )}
                </div>

                {shipToSameAsBillTo ? (
                  displayParty ? (
                    <div className="mt-4 space-y-1 break-words text-sm leading-6 text-slate-600">
                      <p className="font-semibold text-slate-900">
                        {displayParty.display_name ??
                          displayParty.legal_name ??
                          "-"}
                      </p>

                      <p>
                        GSTIN: {displayParty.gstin ?? "-"}
                      </p>

                      <p>
                        Phone: {displayParty.phone ?? "-"}
                      </p>

                      <p>
                        Email: {displayParty.email ?? "-"}
                      </p>

                      <div className="pt-2">
                        {billToAddress ? (
                          <>
                            <p>
                              {billToAddress.address_line1 || "-"}
                            </p>

                            {billToAddress.address_line2 && (
                              <p>{billToAddress.address_line2}</p>
                            )}

                            <p>
                              {[
                                billToAddress.city,
                                billToAddress.state,
                                billToAddress.pincode,
                                billToAddress.country,
                              ]
                                .filter(Boolean)
                                .join(", ") || "-"}
                            </p>
                          </>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      No customer attached.
                    </p>
                  )
                ) : (
                  <div className="mt-4 space-y-1 break-words text-sm leading-6 text-slate-600">
                    <p className="font-semibold text-slate-900">
                      {document.ship_to.name ?? "-"}
                    </p>

                    {document.ship_to.contact_person && (
                      <p>
                        Contact: {document.ship_to.contact_person}
                      </p>
                    )}

                    <p>
                      GSTIN: {document.ship_to.gstin ?? "-"}
                    </p>

                    <p>
                      Phone: {document.ship_to.phone ?? "-"}
                    </p>

                    <p>
                      Email: {document.ship_to.email ?? "-"}
                    </p>

                    <div className="pt-2">
                      <p>
                        {document.ship_to.address_line1 ?? "-"}
                      </p>

                      {document.ship_to.address_line2 && (
                        <p>{document.ship_to.address_line2}</p>
                      )}

                      <p>
                        {[
                          document.ship_to.city,
                          document.ship_to.state,
                          document.ship_to.pincode,
                          document.ship_to.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">{partyLabel}</h2>

          {displayParty ? (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {displayParty.display_name ?? displayParty.legal_name ?? "-"}
                </p>

                <div className="mt-2 space-y-1 text-sm text-slate-500">
                  <p>GSTIN: {displayParty.gstin ?? "-"}</p>

                  <p>Phone: {displayParty.phone ?? "-"}</p>

                  <p>Email: {displayParty.email ?? "-"}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Address
                </p>

                {displayParty.addresses.length > 0 ? (
                  <div className="space-y-3">
                    {displayParty.addresses.map((address) => (
                      <div
                        key={address.id}
                        className="text-sm leading-6 text-slate-600"
                      >
                        <p>{address.address_line1}</p>

                        {address.address_line2 && (
                          <p>{address.address_line2}</p>
                        )}

                        <p>
                          {[address.city, address.state, address.pincode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No address available.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No {partyLabel.toLowerCase()} attached.
            </p>
          )}
        </section>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Items</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Item
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Qty
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rate
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Discount
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Taxable
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    GST
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {document.items.map((item) => {
                  const totalGstPaise =
                    item.cgst_paise + item.sgst_paise + item.igst_paise;

                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.item_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {item.hsn_sac
                            ? `HSN/SAC: ${item.hsn_sac}`
                            : "HSN/SAC: -"}
                          {" · "}
                          {item.unit ?? "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {(item.quantity_milli / 1000).toFixed(3)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatMoney(item.rate_paise)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatMoney(item.discount_paise)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatMoney(item.taxable_amount_paise)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-600">
                        {formatMoney(totalGstPaise)}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatMoney(item.total_paise)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Totals
          </h2>

          <div className="mt-6 ml-auto max-w-md space-y-3 text-sm">
            <div className="flex justify-between gap-4 text-slate-600">
              <span>Subtotal</span>
              <span>{formatMoney(document.totals.subtotal_paise)}</span>
            </div>

            <div className="flex justify-between gap-4 text-slate-600">
              <span>Discount</span>
              <span>- {formatMoney(document.totals.discount_paise)}</span>
            </div>

            {!isPurchaseRoute &&
              document.additional_charge.amount_paise > 0 && (
                <>
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span className="break-words">
                      {document.additional_charge.label ??
                        "Additional Charge"}
                      <span className="ml-1 text-xs text-slate-400">
                        {document.additional_charge.taxable
                          ? `(${formatRateBps(
                              document.additional_charge.gst_rate_bps,
                            )}% GST)`
                          : "(Non-taxable)"}
                      </span>
                    </span>

                    <span className="shrink-0">
                      {formatMoney(
                        document.additional_charge.amount_paise,
                      )}
                    </span>
                  </div>

                  {document.additional_charge.taxable && (
                    <div className="flex justify-between gap-4 text-xs text-slate-500">
                      <span>
                        Charge GST included in tax split
                      </span>

                      <span>
                        {formatMoney(
                          document.additional_charge.tax_paise,
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}

            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-medium text-slate-800">
              <span>Taxable Amount</span>
              <span>
                {formatMoney(
                  document.totals.taxable_amount_paise,
                )}
              </span>
            </div>

            {isInterState ? (
              <div className="flex justify-between gap-4 text-slate-600">
                <span>IGST</span>
                <span>
                  {formatMoney(document.totals.igst_paise)}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>CGST</span>
                  <span>
                    {formatMoney(document.totals.cgst_paise)}
                  </span>
                </div>

                <div className="flex justify-between gap-4 text-slate-600">
                  <span>SGST</span>
                  <span>
                    {formatMoney(document.totals.sgst_paise)}
                  </span>
                </div>
              </>
            )}

            {document.totals.cess_paise > 0 && (
              <div className="flex justify-between gap-4 text-slate-600">
                <span>Cess</span>
                <span>
                  {formatMoney(document.totals.cess_paise)}
                </span>
              </div>
            )}

            {document.totals.round_off_paise !== 0 && (
              <div className="flex justify-between gap-4 text-slate-600">
                <span>Round Off</span>
                <span>
                  {formatMoney(
                    document.totals.round_off_paise,
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Grand Total</span>

              <span>
                {formatMoney(document.totals.total_paise)}
              </span>
            </div>

            {!isPurchaseRoute && (
              <>
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>Amount Paid</span>

                  <span>
                    {formatMoney(
                      document.totals.amount_paid_paise,
                    )}
                  </span>
                </div>

                <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-semibold text-slate-900">
                  <span>Balance Due</span>

                  <span>
                    {formatMoney(balanceDuePaise)}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {!isPurchaseRoute && (
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Notes &amp; Terms
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Customer Notes
                </p>

                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {document.notes?.trim() || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Terms &amp; Conditions
                </p>

                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {document.terms_and_conditions?.trim() || "-"}
                </p>
              </div>
            </div>
          </section>
        )}

        {!isPurchaseRoute &&
          document.document_type === "TAX_INVOICE" &&
          document.status === "ISSUED" && (
            <InvoicePaymentsPanel
              invoiceId={document.id}
              currencyCode={document.currency_code}
              onBalanceChange={(amountPaidPaise) => {
                setDocument((current) =>
                  current && current.id === document.id
                    ? {
                        ...current,
                        totals: {
                          ...current.totals,
                          amount_paid_paise: amountPaidPaise,
                        },
                      }
                    : current,
                );
              }}
              onReceiptHistoryChange={(hasReceipts) => {
                setPaymentHistory({
                  invoiceId: document.id,
                  hasReceipts,
                });
              }}
            />
          )}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "ISSUE" ? "Issue document?" : "Cancel document?"
        }
        description={
          <>
            <p>
              {pendingAction === "ISSUE"
                ? `Are you sure you want to issue ${document.document_number}?`
                : `Are you sure you want to cancel ${document.document_number}?`}
            </p>

            <p className="mt-2">
              {pendingAction === "ISSUE"
                ? "Once issued, this document can no longer be edited."
                : "This action will mark the document as cancelled."}
            </p>

            {actionError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {actionError}
              </p>
            )}
          </>
        }
        confirmLabel={
          pendingAction === "ISSUE" ? "Issue document" : "Cancel document"
        }
        cancelLabel="Keep current status"
        tone={pendingAction === "CANCEL" ? "danger" : "default"}
        isProcessing={isIssuing || isCancelling}
        onConfirm={() => {
          if (pendingAction === "ISSUE") {
            return handleIssue();
          }

          if (pendingAction === "CANCEL") {
            return handleCancel();
          }
        }}
        onCancel={closeActionDialog}
      />
    </main>
  );
}
