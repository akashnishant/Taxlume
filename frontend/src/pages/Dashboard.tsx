import { useEffect, useState } from "react";
import { FileText, Package, Users, Wallet } from "lucide-react";
import { getCustomers } from "../services/customerApi";
import { getProducts } from "../services/productApi";
import { getInvoices } from "../services/invoiceApi";

export default function Dashboard() {
  const [customerCount, setCustomerCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const customers = await getCustomers();
        setCustomerCount(customers.length);
      } catch {
        setCustomerCount(0);
      }
    }

    loadCustomers();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      try {
        const products = await getProducts();
        setProductCount(products.length);
      } catch {
        setProductCount(0);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const result = await getInvoices();
        setInvoiceCount(result.total);
      } catch {
        setInvoiceCount(0);
      }
    }

    loadInvoices();
  }, []);

  const stats = [
    {
      title: "Total Sales",
      value: "₹0.00",
      description: "This month",
      icon: Wallet,
    },
    {
      title: "Invoices",
      value: invoiceCount,
      description: "This month",
      icon: FileText,
    },
    {
      title: "Customers",
      value: customerCount,
      description: "Active customers",
      icon: Users,
    },
    {
      title: "Products",
      value: productCount,
      description: "Active products",
      icon: Package,
    },
  ];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Here's an overview of your business.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {stat.title}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {stat.value}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {stat.description}
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-100 p-2.5">
                    <Icon size={20} className="text-slate-700" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <FileText size={40} className="mx-auto text-slate-300" />

          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            No invoices yet
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Create your first invoice to start tracking your business activity.
          </p>

          <button
            type="button"
            className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create Invoice
          </button>
        </div>
      </main>
    </div>
  );
}
