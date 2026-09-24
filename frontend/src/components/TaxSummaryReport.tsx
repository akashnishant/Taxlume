import { useEffect, useState } from "react";
import LoadingState from "./LoadingState";
import { getTaxSummary, type TaxSummaryResponse } from "../services/reportsApi";
import { Download } from "lucide-react";

type Props = {
  startDate: string;
  endDate: string;
};

function formatAmount(amountPaise: number, currencyCode: string): string {
  const amount = (amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currencyCode} ${amount}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function csvText(value: string): string {
  let safeValue = value;

  // Prevent text from being interpreted as a spreadsheet formula.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(safeValue)) {
    safeValue = `'${safeValue}`;
  }

  return `"${safeValue.replace(/"/g, '""')}"`;
}

function csvAmount(amountPaise: number): string {
  return (amountPaise / 100).toFixed(2);
}

export default function TaxSummaryReport({ startDate, endDate }: Props) {
  const [data, setData] = useState<TaxSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setIsLoading(true);
      setError("");
      setData(null);

      try {
        const result = await getTaxSummary(startDate, endDate);

        if (!cancelled) {
          setData(result);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Unable to load the Document Tax Summary. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, retryKey]);

  function exportTaxSummaryCsv() {
    if (!data || data.monthly_by_currency.length === 0) {
      return;
    }

    setExportError("");

    try {
      const header = [
        "Month",
        "Currency",
        "Issued Invoices",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Cess",
        "Invoice Total",
      ].join(",");

      const rows = data.monthly_by_currency.map((row) =>
        [
          csvText(row.month),
          csvText(row.currency_code),
          String(row.document_count),
          csvAmount(row.taxable_amount_paise),
          csvAmount(row.cgst_paise),
          csvAmount(row.sgst_paise),
          csvAmount(row.igst_paise),
          csvAmount(row.cess_paise),
          csvAmount(row.total_paise),
        ].join(","),
      );

      const csvContent = [header, ...rows].join("\r\n");

      // The BOM helps Excel recognize the CSV as UTF-8.
      const blob = new Blob(["\uFEFF", csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `techabanca-billing-document-tax-summary-${data.filters.start_date}-to-${data.filters.end_date}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch {
      setExportError(
        "Unable to export the Document Tax Summary. Please try again.",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="mt-6">
        <LoadingState
          message="Loading Document Tax Summary..."
          description="Calculating monthly tax figures from issued invoices."
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p role="alert" className="text-sm text-red-700">
          {error || "Unable to display the Document Tax Summary."}
        </p>

        <button
          type="button"
          onClick={() => setRetryKey((current) => current + 1)}
          className="mt-4 rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-lime-200"
        >
          Try again
        </button>
      </section>
    );
  }

  const rows = data.monthly_by_currency;

  return (
    <div className="mt-6">
      <p className="text-sm text-slate-500">
        Reporting period: {formatDate(data.filters.start_date)}
        {" – "}
        {formatDate(data.filters.end_date)}
      </p>

      {rows.length === 0 ? (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <h3 className="font-semibold text-slate-900">
            No issued tax invoices found
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Try selecting a different reporting period.
          </p>
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-semibold text-slate-900">
                Monthly tax breakdown
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Each row represents one month and one currency. Amounts in
                different currencies are not combined.
              </p>
            </div>

            <button
              type="button"
              onClick={exportTaxSummaryCsv}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Month</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Taxable value</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">Cess</th>
                  <th className="px-4 py-3 text-right">Invoice total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={`${row.month}-${row.currency_code}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {formatMonth(row.month)}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {row.currency_code}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.document_count}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatAmount(
                        row.taxable_amount_paise,
                        row.currency_code,
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatAmount(row.cgst_paise, row.currency_code)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatAmount(row.sgst_paise, row.currency_code)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatAmount(row.igst_paise, row.currency_code)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatAmount(row.cess_paise, row.currency_code)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                      {formatAmount(row.total_paise, row.currency_code)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {exportError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {exportError}
        </p>
      )}

      <p className="mt-5 text-xs text-slate-500">
        Figures reflect tax recorded on issued tax invoices in Techabanca Billing. This
        document summary is not a filed GST return or a calculation of final tax
        payable.
      </p>
    </div>
  );
}
