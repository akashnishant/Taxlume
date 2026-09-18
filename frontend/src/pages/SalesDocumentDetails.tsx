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

export default function SalesDocumentDetails() {
  const navigate = useNavigate();
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

  useEffect(() => {
    async function loadDocument() {
      if (!id) {
        setError("Document ID is missing.");
        setIsLoading(false);
        return;
      }

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

  async function handleIssue() {
    if (!document || document.status !== "DRAFT") {
      return;
    }

    const confirmed = window.confirm(
      `Issue ${document.document_number}?\n\nOnce issued, this document can no longer be edited.`,
    );

    if (!confirmed) {
      return;
    }

    setIsIssuing(true);
    setActionError("");

    try {
      await updateDocumentStatus(document.id, "ISSUED");

      setDocument((currentDocument) =>
        currentDocument
          ? {
              ...currentDocument,
              status: "ISSUED",
            }
          : currentDocument,
      );
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

      setActionError("Unable to issue the document. Please try again.");
    } finally {
      setIsIssuing(false);
    }
  }

  async function handleCancel() {
    if (!document || document.status !== "ISSUED") {
      return;
    }

    const confirmed = window.confirm(
      `Cancel ${document.document_number}?\n\nThis action will mark the document as cancelled.`,
    );

    if (!confirmed) {
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
    if (!document) {
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
        <p className="text-sm text-slate-500">Loading {documentLabel}...</p>
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
            <Download size={16} />

            {isGeneratingPdf ? "Generating..." : "Download PDF"}
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
                onClick={handleIssue}
                disabled={isIssuing}
                className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isIssuing ? "Issuing..." : "Issue Document"}
              </button>
            </>
          )}

          {document.status === "ISSUED" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="cursor-pointer rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? "Cancelling..." : "Cancel Document"}
            </button>
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
                Reference
              </p>

              <p className="mt-1 text-sm font-medium text-slate-900">
                {document.reference_number ?? "-"}
              </p>
            </div>
          </div>
        </section>

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
          <h2 className="text-lg font-semibold text-slate-900">Totals</h2>

          <div className="mt-6 ml-auto max-w-sm space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Gross Amount</span>
              <span>{formatMoney(document.totals.subtotal_paise)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>- {formatMoney(document.totals.discount_paise)}</span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3 font-medium text-slate-800">
              <span>Taxable Amount</span>
              <span>{formatMoney(document.totals.taxable_amount_paise)}</span>
            </div>

            {isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>IGST</span>
                <span>{formatMoney(document.totals.igst_paise)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST</span>
                  <span>{formatMoney(document.totals.cgst_paise)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>SGST</span>
                  <span>{formatMoney(document.totals.sgst_paise)}</span>
                </div>
              </>
            )}

            {document.totals.cess_paise > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Cess</span>
                <span>{formatMoney(document.totals.cess_paise)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total</span>

              <span>{formatMoney(document.totals.total_paise)}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
