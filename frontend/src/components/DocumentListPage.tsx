import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getInvoices, type Invoice } from "../services/invoiceApi";

import {
  formatDocumentStatus,
  formatDocumentType,
  formatMoneyPaise,
} from "../utils/documentDisplay";

import LoadingState from "./LoadingState";

type DocumentListPageProps = {
  title: string;
  description: string;
  newButtonLabel: string;
  newPath: string;
  detailsBasePath: string;
  allowedDocumentTypes: string[];
};

type StatusFilter = "ALL" | Invoice["status"];

type DocumentTypeFilter = "ALL" | Invoice["document_type"];

export default function DocumentListPage({
  title,
  description,
  newButtonLabel,
  newPath,
  detailsBasePath,
  allowedDocumentTypes,
}: DocumentListPageProps) {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [documentType, setDocumentType] = useState<DocumentTypeFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const [documents, setDocuments] = useState<Invoice[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDocuments() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getInvoices();

        setDocuments(response.documents);
      } catch {
        setError("Unable to load documents. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDocuments();
  }, []);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return documents.filter((document) => {
      if (!allowedDocumentTypes.includes(document.document_type)) {
        return false;
      }

      const matchesSearch =
        !normalizedSearch ||
        document.document_number.toLowerCase().includes(normalizedSearch) ||
        formatDocumentType(document.document_type)
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesDocumentType =
        documentType === "ALL" || document.document_type === documentType;

      const matchesStatus = status === "ALL" || document.status === status;

      return matchesSearch && matchesDocumentType && matchesStatus;
    });
  }, [documents, search, status, documentType, allowedDocumentTypes]);

  const hasActiveFilters =
    search.trim() !== "" || documentType !== "ALL" || status !== "ALL";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>

          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          onClick={() => navigate(newPath)}
        >
          <Plus size={18} />
          {newButtonLabel}
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <select
            value={documentType}
            onChange={(event) =>
              setDocumentType(event.target.value as DocumentTypeFilter)
            }
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">All document types</option>

            {allowedDocumentTypes.map((type) => (
              <option key={type} value={type}>
                {formatDocumentType(type)}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>

                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>
                    <LoadingState
                      message={`Loading ${title.toLowerCase()}...`}
                      description="Fetching your documents and their latest statuses."
                    />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-sm text-red-600">{error}</p>
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-4 rounded-full bg-slate-100 p-4">
                        <FileText size={28} className="text-slate-500" />
                      </div>

                      <h2 className="text-lg font-semibold text-slate-900">
                        {hasActiveFilters
                          ? "No matching documents"
                          : "No documents yet"}
                      </h2>

                      <p className="mt-1 max-w-md text-sm text-slate-500">
                        {hasActiveFilters
                          ? "Try changing your search or filters."
                          : "Create your first document to get started."}
                      </p>

                      {!hasActiveFilters && (
                        <button
                          type="button"
                          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          onClick={() => navigate(newPath)}
                        >
                          <Plus size={18} />
                          {newButtonLabel}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((document) => (
                  <tr
                    key={document.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {document.document_number}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDocumentType(document.document_type)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {document.document_date}
                    </td>

                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {formatMoneyPaise(document.total_paise)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDocumentStatus(document.status)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`${detailsBasePath}/${document.id}`)
                        }
                        className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
