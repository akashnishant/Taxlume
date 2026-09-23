import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import LoadingState from "../components/LoadingState";
import {
  getReportRegister,
  type SalesRegisterDocument,
  type SalesRegisterResponse,
} from "../services/reportsApi";
import TaxSummaryReport from "../components/TaxSummaryReport";
import BusinessAnalyticsOverview from "../components/BusinessAnalyticsOverview";

type DateRange = {
  startDate: string;
  endDate: string;
};

function getCurrentMonthRange(): DateRange {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

function formatAmount(amountPaise: number, currencyCode: string): string {
  const amount = (amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currencyCode} ${amount}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function csvText(value: string | null | undefined): string {
  let text = value ?? "";

  // Prevent user-entered document numbers or customer names
  // from being interpreted as spreadsheet formulas.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function csvAmount(amountPaise: number): string {
  return (amountPaise / 100).toFixed(2);
}

function salesRegisterCsvRow(invoice: SalesRegisterDocument): string {
  return [
    csvText(invoice.document_date),
    csvText(invoice.document_number),
    csvText(invoice.party_name),
    csvText(invoice.currency_code),
    csvAmount(invoice.taxable_amount_paise),
    csvAmount(invoice.cgst_paise),
    csvAmount(invoice.sgst_paise),
    csvAmount(invoice.igst_paise),
    csvAmount(invoice.cess_paise),
    csvAmount(invoice.total_paise),
  ].join(",");
}

export default function Reports() {
  const navigate = useNavigate();

  const [reportType, setReportType] = useState<
    "overview" | "sales" | "purchase-orders" | "tax-summary"
  >("overview");

  const [draftRange, setDraftRange] = useState<DateRange>(getCurrentMonthRange);

  const [appliedRange, setAppliedRange] =
    useState<DateRange>(getCurrentMonthRange);

  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const [data, setData] = useState<SalesRegisterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [exportError, setExportError] = useState("");

  const isSalesReport = reportType === "sales";
  const isTaxReport = reportType === "tax-summary";

  const reportTitle = isTaxReport
    ? "Document Tax Summary"
    : isSalesReport
      ? "Sales Register"
      : "Purchase Order Register";

  const documentLabel = isSalesReport ? "Invoice" : "Purchase Order";

  const partyLabel = isSalesReport ? "Customer" : "Vendor";

  const documentBasePath = isSalesReport ? "/sales" : "/purchases";

  useEffect(() => {
    if (reportType === "tax-summary" || reportType === "overview") {
      setIsLoading(false);
      setError("");
      setData(null);
      return;
    }

    const activeRegister = reportType;
    let cancelled = false;

    async function loadReport() {
      setIsLoading(true);
      setError("");
      setData(null);

      try {
        const result = await getReportRegister(
          activeRegister,
          appliedRange.startDate,
          appliedRange.endDate,
          page,
        );

        if (!cancelled) {
          setData(result);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load the Sales Register. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [reportType, appliedRange, page, retryKey]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftRange.startDate || !draftRange.endDate) {
      setFilterError("Please select both reporting dates.");
      return;
    }

    if (draftRange.startDate > draftRange.endDate) {
      setFilterError("Start Date cannot be after End Date.");
      return;
    }

    setFilterError("");
    setPage(1);

    setAppliedRange({
      startDate: draftRange.startDate,
      endDate: draftRange.endDate,
    });
  }

  async function exportSalesRegisterCsv() {
    if (
      isExporting ||
      isLoading ||
      !data ||
      (reportType !== "sales" && reportType !== "purchase-orders")
    ) {
      return;
    }

    const exportReportType = reportType;

    // Keep the rest of your existing export function here.

    // Capture the dates currently displayed in the report,
    // even if the user edits the date inputs during export.
    const { start_date: startDate, end_date: endDate } = data.filters;

    setIsExporting(true);
    setExportError("");
    setExportProgress("Preparing your CSV export...");

    try {
      const firstPage = await getReportRegister(
        exportReportType,
        startDate,
        endDate,
        1,
      );

      const expectedTotal = firstPage.pagination.total;
      const expectedPages = firstPage.pagination.total_pages;

      const allDocuments: SalesRegisterDocument[] = [...firstPage.documents];

      const seenIds = new Set(firstPage.documents.map((invoice) => invoice.id));

      setExportProgress(
        `Retrieving ${allDocuments.length} of ${expectedTotal} invoices...`,
      );

      for (let nextPage = 2; nextPage <= expectedPages; nextPage++) {
        const result = await getReportRegister(
          exportReportType,
          startDate,
          endDate,
          nextPage,
        );

        if (
          result.pagination.total !== expectedTotal ||
          result.pagination.total_pages !== expectedPages
        ) {
          throw new Error(
            "The report changed during export. Please try again.",
          );
        }

        for (const invoice of result.documents) {
          if (seenIds.has(invoice.id)) {
            throw new Error(
              "The report changed during export. Please try again.",
            );
          }

          seenIds.add(invoice.id);
          allDocuments.push(invoice);
        }

        setExportProgress(
          `Retrieving ${allDocuments.length} of ${expectedTotal} invoices...`,
        );
      }

      if (allDocuments.length !== expectedTotal) {
        throw new Error("The export is incomplete. Please try again.");
      }

      const header = [
        "Date",
        isSalesReport ? "Invoice Number" : "Purchase Order Number",
        partyLabel,
        "Currency",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Cess",
        isSalesReport ? "Invoice Total" : "Order Total",
      ].join(",");

      const csvLines = [header, ...allDocuments.map(salesRegisterCsvRow)];

      const csvContent = csvLines.join("\r\n");

      // UTF-8 BOM helps Excel recognize characters in customer names.
      const blob = new Blob(["\uFEFF", csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `techabanca-billing-${exportReportType === "sales" ? "sales-register" : "purchase-order-register"}-${startDate}-to-${endDate}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Unable to export the Sales Register. Please try again.",
      );
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  }

  const totalDocuments = data?.pagination.total ?? 0;
  const currentPage = data?.pagination.page ?? page;
  const totalPages = data?.pagination.total_pages ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

        <p className="mt-2 text-sm text-slate-500">
          Review your business documents and reporting totals.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div
          role="group"
          aria-label="Report type"
          className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4"
        >
          {(
            [
              { value: "overview", label: "Business Overview" },
              { value: "sales", label: "Sales Register" },
              {
                value: "purchase-orders",
                label: "Purchase Order Register",
              },
              {
                value: "tax-summary",
                label: "Document Tax Summary",
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              disabled={isExporting}
              onClick={() => {
                if (reportType === tab.value) return;

                setReportType(tab.value);
                setPage(1);
                setError("");
                setExportError("");
                setExportProgress("");
              }}
              aria-pressed={reportType === tab.value}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                reportType === tab.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {reportType !== "overview" && (
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              {reportTitle}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {isTaxReport
                ? "Monthly taxable value and tax amounts recorded on issued tax invoices. Figures are separated by currency."
                : isSalesReport
                  ? "Issued tax invoices only. Drafts, cancelled invoices, quotations, and proforma invoices are excluded."
                  : "Issued purchase orders only. Drafts and cancelled orders are excluded. Purchase orders represent orders placed—not confirmed purchase expenditure or claimable input GST."}
            </p>
          </div>
        )}

        {reportType !== "overview" && (
          <>
            <form
              onSubmit={applyFilters}
              className="flex flex-wrap items-end gap-4"
            >
              <div>
                <label
                  htmlFor="report-start-date"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Start Date
                </label>

                <input
                  id="report-start-date"
                  type="date"
                  value={draftRange.startDate}
                  onChange={(event) =>
                    setDraftRange((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="report-end-date"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  End Date
                </label>

                <input
                  id="report-end-date"
                  type="date"
                  value={draftRange.endDate}
                  onChange={(event) =>
                    setDraftRange((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || isExporting}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply Filters
              </button>
            </form>

            {filterError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {filterError}
              </p>
            )}
          </>
        )}
      </section>

      {reportType === "overview" ? (
        <div className="mt-6">
          <BusinessAnalyticsOverview showTopCustomers />
        </div>
      ) : isTaxReport ? (
        <TaxSummaryReport
          startDate={appliedRange.startDate}
          endDate={appliedRange.endDate}
        />
      ) : isLoading ? (
        <div className="mt-6">
          <LoadingState
            message={`Loading ${reportTitle}...`}
            description="Calculating totals and retrieving matching documents."
          />
        </div>
      ) : error || !data ? (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p role="alert" className="text-sm text-red-700">
            {error || "Unable to display the Sales Register."}
          </p>

          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </section>
      ) : (
        <>
          <div className="mt-6">
            <p className="text-sm text-slate-500">
              Reporting period: {formatDate(data.filters.start_date)}
              {" – "}
              {formatDate(data.filters.end_date)}
            </p>
          </div>

          {data.summary_by_currency.length === 0 ? (
            <section className="mt-5 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
              <FileText size={34} className="mx-auto text-slate-300" />

              <h3 className="mt-3 font-semibold text-slate-900">
                {isSalesReport
                  ? "No issued tax invoices found"
                  : "No issued purchase orders found"}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try selecting a different reporting period.
              </p>
            </section>
          ) : (
            <>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {data.summary_by_currency.map((summary) => {
                  const gstPaise =
                    summary.cgst_paise +
                    summary.sgst_paise +
                    summary.igst_paise;

                  return (
                    <section
                      key={summary.currency_code}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">
                          {isSalesReport ? "Sales" : "Purchase Orders"} ·{" "}
                          {summary.currency_code}
                        </h3>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {summary.document_count}{" "}
                          {isSalesReport ? "invoices" : "orders"}
                        </span>
                      </div>

                      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-500">
                        {isSalesReport ? "Invoice total" : "Order total"}
                      </p>

                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {formatAmount(
                          summary.total_paise,
                          summary.currency_code,
                        )}
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-xs text-slate-500">
                            Taxable value
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatAmount(
                              summary.taxable_amount_paise,
                              summary.currency_code,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            {isSalesReport ? "GST" : "GST recorded on orders"}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatAmount(gstPaise, summary.currency_code)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Cess</p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatAmount(
                              summary.cess_paise,
                              summary.currency_code,
                            )}
                          </p>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>

              <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {isSalesReport
                        ? "Invoice register"
                        : "Purchase order register"}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {totalDocuments} matching issued{" "}
                      {isSalesReport ? "invoices" : "purchase orders"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-slate-500">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => void exportSalesRegisterCsv()}
                      disabled={isExporting || isLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={16} />

                      {isExporting ? "Exporting..." : "Export CSV"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">{documentLabel}</th>
                        <th className="px-4 py-3">{partyLabel}</th>
                        <th className="px-4 py-3 text-right">Taxable value</th>
                        <th className="px-4 py-3 text-right">
                          {isSalesReport ? "GST + Cess" : "Recorded GST + Cess"}
                        </th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {data.documents.map((invoice) => {
                        const taxPaise =
                          invoice.cgst_paise +
                          invoice.sgst_paise +
                          invoice.igst_paise +
                          invoice.cess_paise;

                        return (
                          <tr key={invoice.id}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {formatDate(invoice.document_date)}
                            </td>

                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`${documentBasePath}/${invoice.id}`)
                                }
                                className="cursor-pointer font-semibold text-slate-900 hover:underline"
                              >
                                {invoice.document_number}
                              </button>
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {invoice.party_name || "—"}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                              {formatAmount(
                                invoice.taxable_amount_paise,
                                invoice.currency_code,
                              )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                              {formatAmount(taxPaise, invoice.currency_code)}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                              {formatAmount(
                                invoice.total_paise,
                                invoice.currency_code,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={currentPage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={currentPage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </section>

              {isExporting && (
                <p role="status" className="mt-3 text-sm text-slate-600">
                  {exportProgress}
                </p>
              )}

              {exportError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {exportError}
                </p>
              )}
            </>
          )}

          <p className="mt-5 text-xs text-slate-500">
            {isSalesReport
              ? "Figures are based on issued tax invoices recorded in Techabanca Billing. This report is not a filed GST return."
              : "Figures are based on issued purchase orders recorded in Techabanca Billing. Order amounts are not proof of completed purchases, and tax recorded on purchase orders is not necessarily eligible input tax credit."}
          </p>
        </>
      )}
    </main>
  );
}
