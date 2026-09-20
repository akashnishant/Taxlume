import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  FileText,
  ReceiptIndianRupee,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardSummary,
  type DashboardData,
  type DashboardRecentDocument,
} from "../services/dashboardApi";
import BusinessAnalyticsOverview from "../components/BusinessAnalyticsOverview";
import LoadingState from "../components/LoadingState";

function formatMoney(amountPaise: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode || "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: string): string {
  switch (status) {
    case "ISSUED":
      return "Issued";

    case "DRAFT":
      return "Draft";

    case "CANCELLED":
      return "Cancelled";

    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "ISSUED":
      return "bg-emerald-50 text-emerald-700";

    case "CANCELLED":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

type RecentDocumentsProps = {
  title: string;
  documents: DashboardRecentDocument[];
  emptyText: string;
  basePath: "/sales" | "/purchases";
};

function RecentDocuments({
  title,
  documents,
  emptyText,
  basePath,
}: RecentDocumentsProps) {
  const navigate = useNavigate();

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>

        <button
          type="button"
          onClick={() => navigate(basePath)}
          className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          View all
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <FileText size={32} className="mx-auto text-slate-300" />

          <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {documents.map((document) => (
            <button
              key={document.id}
              type="button"
              onClick={() => navigate(`${basePath}/${document.id}`)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {document.document_number}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {document.party_name || "No party"} ·{" "}
                  {formatDate(document.document_date)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {formatMoney(document.total_paise, document.currency_code)}
                </p>

                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(
                    document.status,
                  )}`}
                >
                  {statusLabel(document.status)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setIsLoading(true);
      setError("");

      const result = await getDashboardSummary();

      setData(result);
    } catch (loadError) {
      console.error("Unable to load dashboard:", loadError);

      setData(null);

      setError("Unable to load your business dashboard. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <LoadingState
          message="Loading your dashboard..."
          description="Retrieving your latest sales, purchases, and business summary."
        />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const { summary, recent_sales, recent_purchases } = data;

  const stats = [
    {
      title: "Purchase Orders",
      value: formatMoney(summary.total_purchases_paise, summary.currency_code),
      description: "Issued orders · All time",
      icon: ArrowDownLeft,
    },
    {
      title: "Purchase Orders This Month",
      value: formatMoney(
        summary.this_month_purchases_paise,
        summary.currency_code,
      ),
      description: "Issued orders · Current month",
      icon: ReceiptIndianRupee,
    },
    {
      title: "Active Customers",
      value: summary.customer_count.toString(),
      description: "Customers available to your company",
      icon: Users,
    },
  ];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>

            <p className="mt-1 text-sm text-slate-500">
              Here's an overview of your business.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/sales/new")}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <FileText size={18} />
            Create Sale
          </button>
        </div>

        <div className="mb-8">
          <BusinessAnalyticsOverview />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500">
                      {stat.title}
                    </p>

                    <p className="mt-2 truncate text-2xl font-bold text-slate-900">
                      {stat.value}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {stat.description}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-lg bg-slate-100 p-2.5">
                    <Icon size={20} className="text-slate-700" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <RecentDocuments
            title="Recent Sales"
            documents={recent_sales}
            emptyText="No tax invoices have been created yet."
            basePath="/sales"
          />

          <RecentDocuments
            title="Recent Purchase Orders"
            documents={recent_purchases}
            emptyText="No purchase orders have been created yet."
            basePath="/purchases"
          />
        </div>
      </main>
    </div>
  );
}
