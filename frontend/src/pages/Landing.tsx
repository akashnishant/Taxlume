import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  FileBarChart2,
  FileText,
  Menu,
  Package,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import PricingSection from "../components/PricingSection";
import BrandMark from "../components/BrandMark";

const features = [
  {
    icon: FileText,
    title: "Create professional invoices",
    description:
      "Prepare and download invoices without rebuilding the same document from scratch each time.",
  },
  {
    icon: WalletCards,
    title: "Keep collections in view",
    description:
      "Record customer payments, including partial payments, and see what remains outstanding.",
  },
  {
    icon: UsersRound,
    title: "Organize business contacts",
    description:
      "Keep customer and vendor details together so they are easier to find when you need them.",
  },
  {
    icon: Package,
    title: "Manage your products",
    description:
      "Maintain a product list and reuse saved details while preparing business documents.",
  },
  {
    icon: BarChart3,
    title: "Understand business activity",
    description:
      "Explore invoiced sales, recorded collections, receivables, and customer activity in one dashboard.",
  },
  {
    icon: FileBarChart2,
    title: "Work with useful reports",
    description:
      "Review sales, purchase orders, and tax summaries, with export options for supported reports.",
  },
];

const faqs = [
  {
    question: "What can I do with Techabanca Billing?",
    answer:
      "You can create business documents, maintain customers, vendors, and products, record invoice payments, and review business dashboards and reports.",
  },
  {
    question: "Can I track partial payments?",
    answer:
      "Yes. You can record payments against an invoice and view its remaining outstanding balance.",
  },
  {
    question: "Do I need to provide business details when registering?",
    answer:
      "Yes. Registration includes account information and the basic details needed to set up your business workspace.",
  },
  {
    question: "Does creating an account activate a subscription?",
    answer:
      "No. After registration, you can sign in and choose an available Techabanca Billing plan.",
  },
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      href="#top"
      aria-label="Back to the top of the Techabanca Billing landing page"
      className="inline-flex items-center gap-3"
    >
      <BrandMark />
      <span
        className={`flex flex-col text-base font-bold leading-tight tracking-tight sm:text-lg ${
          light ? "text-white" : "text-slate-950"
        }`}
      >
        <span>Techabanca</span>
        <span className={`text-[10px] uppercase tracking-[0.2em] ${
          light ? "text-lime-300" : "text-emerald-800"
        }`}>Billing</span>
      </span>
    </a>
  );
}

function PrimaryLink({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <Link
      to="/register"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 ${
        dark
          ? "bg-slate-950 text-white shadow-slate-950/15 hover:bg-slate-800 focus-visible:outline-slate-950"
          : "bg-lime-300 text-slate-950 shadow-lime-300/20 hover:bg-lime-200 focus-visible:outline-lime-300"
      }`}
    >
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}

function WorkspacePreview() {
  const bars = [
    { sales: 40, collections: 27 },
    { sales: 58, collections: 46 },
    { sales: 49, collections: 36 },
    { sales: 73, collections: 54 },
    { sales: 65, collections: 58 },
    { sales: 88, collections: 69 },
    { sales: 78, collections: 73 },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-lime-400/15 blur-3xl" />

      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_35px_100px_-25px_rgba(2,6,23,0.7)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
              T
            </span>
            <span className="text-sm font-bold text-slate-900">
              Business overview
            </span>
          </div>

          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
            SAMPLE WORKSPACE
          </span>
        </div>

        <div className="bg-slate-50 p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4">
              <p className="text-[10px] font-medium text-slate-500 sm:text-xs">
                Invoiced sales
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900 sm:text-2xl">
                ₹2,40,000
              </p>
              <span className="mt-2 inline-block rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                Excluding tax
              </span>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4">
              <p className="text-[10px] font-medium text-slate-500 sm:text-xs">
                Recorded collections
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900 sm:text-2xl">
                ₹1,85,000
              </p>
              <span className="mt-2 inline-block rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                Payment tracking
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-100 bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Sales & collections
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Illustrative monthly activity
                </p>
              </div>
              <BarChart3
                size={18}
                className="text-teal-600"
                aria-hidden="true"
              />
            </div>

            <div
              className="mt-5 flex h-32 items-end justify-between gap-2 border-b border-slate-200 pb-1 sm:h-40"
              aria-label="Illustrative sales and collections bar chart"
              role="img"
            >
              {bars.map((bar, index) => (
                <div
                  key={index}
                  className="flex h-full flex-1 items-end justify-center gap-1"
                >
                  <span
                    className="w-full max-w-5 rounded-t bg-teal-600"
                    style={{ height: `${bar.sales}%` }}
                  />
                  <span
                    className="w-full max-w-5 rounded-t bg-emerald-400"
                    style={{ height: `${bar.collections}%` }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600">
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-teal-600" />
                Sales
              </span>
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Collections
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3">
            <div>
              <p className="text-[11px] text-slate-500">Current outstanding</p>
              <p className="mt-1 text-base font-bold text-slate-900">₹55,000</p>
            </div>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
              <WalletCards size={20} aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-white/60">
        Illustrative product preview using sample figures
      </p>
    </div>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute -left-32 top-28 h-80 w-80 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/95 text-white shadow-lg shadow-slate-950/10 backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:px-10">
            <Brand light />

            <nav
              className="hidden items-center justify-center gap-7 whitespace-nowrap text-sm font-medium text-slate-300 lg:flex lg:gap-9"
              aria-label="Main navigation"
            >
              <a href="#features" className="hover:text-white">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-white">
                How it works
              </a>
              <a href="#pricing" className="hover:text-white">
                Pricing
              </a>
              <a href="#faq" className="hover:text-white">
                FAQs
              </a>
            </nav>

            <div className="hidden items-center justify-end gap-3 lg:flex">
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-semibold text-white hover:text-lime-200"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-lime-100"
              >
                Get started
              </Link>
            </div>

            <button
              type="button"
              className="rounded-lg border border-white/20 p-2 text-white lg:hidden justify-self-end"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {menuOpen && (
            <nav
              id="landing-mobile-menu"
              aria-label="Mobile navigation"
              className="border-t border-white/10 bg-slate-950 px-5 pb-5 pt-3 lg:hidden"
            >
              <div className="flex flex-col gap-1">
                <a
                  href="#features"
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-3 text-sm text-slate-200 hover:bg-white/10"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-3 text-sm text-slate-200 hover:bg-white/10"
                >
                  How it works
                </a>
                <a
                  href="#pricing"
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-3 text-sm text-slate-200 hover:bg-white/10"
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-3 text-sm text-slate-200 hover:bg-white/10"
                >
                  FAQs
                </a>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-3 text-sm text-slate-200 hover:bg-white/10"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="mt-2 rounded-lg bg-lime-300 px-3 py-3 text-center text-sm font-bold text-slate-950"
                >
                  Get started
                </Link>
              </div>
            </nav>
          )}
        </header>

        <main>
          <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-2 lg:gap-10 lg:px-10 lg:pb-28 lg:pt-40">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-xs font-semibold text-lime-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                BILLING • COLLECTIONS • REPORTS
              </div>

              <h1 className="mt-7 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Less paperwork.
                <span className="mt-2 block text-lime-300">
                  More clarity for your business.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                Create invoices, organize customers and products, track
                payments, and understand business activity — all from one
                Techabanca Billing workspace.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <PrimaryLink>Get started with Techabanca Billing</PrimaryLink>

                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-white hover:text-lime-200"
                >
                  Explore features
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Check size={16} className="text-emerald-400" />
                  Invoicing & payment tracking
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={16} className="text-emerald-400" />
                  Business dashboards
                </span>
              </div>
            </div>

            <WorkspacePreview />
          </section>
        </main>
      </div>

      <section
        id="features"
        className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
              What you can do
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your everyday business work, in one place.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Move from preparing an invoice to tracking its payment and
              reviewing business activity without juggling separate records.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/60"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <Icon size={23} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 bg-white px-5 py-20 sm:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
              Getting started
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              From sign-up to your business workspace.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Set up your account and firm, choose a billing plan, and start
              working with Techabanca Billing.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              {
                number: "01",
                icon: Building2,
                title: "Create your account",
                text: "Enter your account and business details to set up your workspace.",
              },
              {
                number: "02",
                icon: WalletCards,
                title: "Choose a billing plan",
                text: "Sign in after registration and select an available subscription.",
              },
              {
                number: "03",
                icon: FileText,
                title: "Start managing business",
                text: "Add your records, create documents, and track business activity.",
              },
            ].map((step) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.number}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black tracking-widest text-emerald-800">
                      {step.number}
                    </span>
                    <Icon
                      size={22}
                      className="text-slate-500"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-7 text-xl font-bold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {step.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-8 overflow-hidden rounded-[2rem] bg-emerald-50 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:p-14">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
              Made for business owners
            </span>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Give your business records a place of their own.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Keep invoicing, customer information, recorded payments, and
              reporting connected in a single workspace.
            </p>
          </div>
          <div>
            <PrimaryLink dark>Create your account</PrimaryLink>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-20 bg-white px-5 py-20 sm:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
              FAQs
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Questions before getting started?
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-slate-200 bg-white px-5 py-4 open:border-emerald-200 open:bg-emerald-50/30"
              >
                <summary className="flex list-none items-center justify-between gap-4 text-left text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 text-slate-500 transition group-open:rotate-180"
                  />
                </summary>
                <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-7 text-slate-600">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-20 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold text-lime-300">
              YOUR BUSINESS. ONE WORKSPACE.
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Bring your billing and business records together.
            </h2>
          </div>
          <PrimaryLink>Get started with Techabanca Billing</PrimaryLink>
        </div>
      </section>

      <footer className="bg-slate-950 px-5 pb-10 text-slate-400 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Brand light />
          <p className="text-xs">
            © {new Date().getFullYear()} Techabanca Billing. All rights reserved.
          </p>
          <Link to="/login" className="text-sm hover:text-white">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
