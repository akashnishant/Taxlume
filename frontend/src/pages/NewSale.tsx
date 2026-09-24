import { ArrowLeft, FileText, ReceiptText, Truck } from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCustomers } from "../services/customerApi";

import type { DocumentPartyOption } from "../types/documentParty";
import { toDocumentPartyOption } from "../utils/documentParty";

import DocumentEntryForm from "../components/DocumentEntryForm";

type SalesDocumentType =
  | "TAX_INVOICE"
  | "PROFORMA_INVOICE"
  | "QUOTATION"
  | "DELIVERY_CHALLAN";

const documentTypes: Array<{
  type: SalesDocumentType;
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    type: "TAX_INVOICE",
    title: "Tax Invoice",
    description: "Create a GST-compliant invoice for a completed sale.",
    icon: ReceiptText,
  },
  {
    type: "PROFORMA_INVOICE",
    title: "Proforma Invoice",
    description: "Create a preliminary invoice before the final sale.",
    icon: FileText,
  },
  {
    type: "QUOTATION",
    title: "Quotation",
    description: "Prepare and send a quotation to a customer.",
    icon: FileText,
  },
  {
    type: "DELIVERY_CHALLAN",
    title: "Delivery Challan",
    description: "Create a document for the movement or delivery of goods.",
    icon: Truck,
  },
];

export default function NewSale() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedType = searchParams.get("type") as SalesDocumentType | null;
  const [customers, setCustomers] = useState<DocumentPartyOption[]>([]);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState("");

  const selectedDocumentConfig = selectedType
    ? documentTypes.find((document) => document.type === selectedType)
    : null;

  useEffect(() => {
    if (!selectedDocumentConfig) {
      return;
    }

    async function loadCustomers() {
      setIsCustomersLoading(true);
      setCustomerLoadError("");

      try {
        const response = await getCustomers();

        setCustomers(
          response
            .filter((customer) => customer.is_active)
            .map(toDocumentPartyOption),
        );
      } catch {
        setCustomers([]);
        setCustomerLoadError("Unable to load customers. Please try again.");
      } finally {
        setIsCustomersLoading(false);
      }
    }

    void loadCustomers();
  }, [selectedDocumentConfig]);

  const [documentType, setDocumentType] =
    useState<SalesDocumentType>("TAX_INVOICE");

  if (selectedType && selectedDocumentConfig) {
    return (
      <DocumentEntryForm
        config={{
          mode: "SALES",
          title: `New ${selectedDocumentConfig.title}`,
          description: selectedDocumentConfig.description,
          partyLabel: "Customer",
          partyPlaceholder: "Select customer",
          backPath: "/sales/new",
          saveRedirectPath: "/sales",
          documentType: selectedType,
          parties: customers,
          isPartiesLoading: isCustomersLoading,
          partyLoadError: customerLoadError,
        }}
      />
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate("/sales")}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Sales
        </button>

        <h1 className="text-2xl font-bold text-slate-900">New Sale</h1>

        <p className="mt-1 text-sm text-slate-500">
          Select the type of sales document you want to create.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Document Type</h2>

        <p className="mt-1 text-sm text-slate-500">
          Choose a document type to continue.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {documentTypes.map((document) => {
            const Icon = document.icon;
            const isSelected = documentType === document.type;

            return (
              <button
                key={document.type}
                type="button"
                onClick={() => setDocumentType(document.type)}
                className={`cursor-pointer rounded-lg border p-5 text-left transition ${
                  isSelected
                    ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                    : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`rounded-md p-3 ${
                      isSelected
                        ? "bg-lime-300 text-slate-950"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon size={22} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {document.title}
                    </h3>

                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      {document.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={() => navigate(`/sales/new?type=${documentType}`)}
            className="inline-flex cursor-pointer items-center justify-center rounded-md bg-lime-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}
