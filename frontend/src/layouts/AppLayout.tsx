import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { getSession } from "../services/sessionStorage";
import { getCompany, type Company } from "../services/companyApi";
import { endSession } from "../services/endSession";
import BrandMark from "../components/BrandMark";

const navigation = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Sales",
    path: "/sales",
    icon: FileText,
  },
  {
    label: "Purchases",
    path: "/purchases",
    icon: ShoppingCart,
  },
  {
    label: "Expenses",
    path: "/expenses",
    icon: Receipt,
  },
  {
    label: "Customers",
    path: "/customers",
    icon: Users,
  },
  {
    label: "Vendors",
    path: "/vendors",
    icon: Truck,
  },
  {
    label: "Products & Services",
    path: "/products",
    icon: Package,
  },
  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

function getInitials(fullName?: string | null): string {
  const nameParts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (nameParts.length === 0) {
    return "U";
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const session = getSession();

  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    async function loadCompany() {
      try {
        const data = await getCompany();
        setCompany(data);
      } catch {
        setCompany(null);
      }
    }

    loadCompany();
  }, []);

  function handleLogout() {
    endSession("manual");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <Link
            to="/"
            className="flex items-center gap-3"
            onClick={() => setSidebarOpen(false)}
          >
            <BrandMark className="h-9 w-9" />
            <span className="flex flex-col leading-tight text-slate-900">
              <span className="text-base font-bold tracking-tight">Techabanca</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800">Billing</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "relative overflow-hidden bg-slate-900 text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-lime-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <div
              aria-label="User initials"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
            >
              {getInitials(session?.user.full_name)}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {session?.user.full_name ?? "User"}
              </p>

              <p className="text-xs text-slate-500">Owner</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <Building2 size={18} className="text-slate-400" />

            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">
                {company?.trade_name ||
                  company?.legal_name ||
                  session?.company.trade_name ||
                  "Company"}
              </p>

              <p className="text-xs text-slate-500">Company Account</p>
            </div>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
