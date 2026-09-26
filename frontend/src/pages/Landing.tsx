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

const capabilities = [
  {
    icon: FileText,
    title: "Sales documents",
    description:
      "Create professional invoices and keep your sales records in one workspace.",
  },
  {
    icon: WalletCards,
    title: "Payment tracking",
    description:
      "Record collections, including partial payments, and keep outstanding amounts visible.",
  },
  {
    icon: Building2,
    title: "Purchases",
    description:
      "Maintain purchase activity alongside the rest of your business records.",
  },
  {
    icon: UsersRound,
    title: "Customers & vendors",
    description:
      "Keep the business contacts you work with organized and easy to reuse.",
  },
  {
    icon: Package,
    title: "Products & services",
    description:
      "Maintain reusable product and service information for everyday billing work.",
  },
  {
    icon: FileBarChart2,
    title: "Expenses & reports",
    description:
      "Record expenses and review business activity through focused reports.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Create the record",
    description:
      "Start with the document, customer, vendor, product, purchase, or expense you need.",
  },
  {
    number: "02",
    title: "Keep activity connected",
    description:
      "Record collections and maintain the information related to the same business workflow.",
  },
  {
    number: "03",
    title: "See what is outstanding",
    description:
      "Keep receivables, payments, expenses, and other day-to-day records easier to review.",
  },
  {
    number: "04",
    title: "Understand the business",
    description:
      "Use dashboards and reports to turn the records you entered into useful visibility.",
  },
];

const faqs = [
  {
    question: "What can I do with Techabanca Billing?",
    answer:
      "You can create business documents, maintain customers, vendors, products and services, record invoice payments, manage expenses, and review business dashboards and reports.",
  },
  {
    question: "Can I track partial payments?",
    answer:
      "Yes. You can record payments against an invoice and view the remaining outstanding balance.",
  },
  {
    question: "Does Techabanca Billing include expense management?",
    answer:
      "Yes. The workspace includes expense records, categories, recurring expenses, and expense reporting.",
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
      aria-label="Back to the top of the Techabanca Billing welcome page"
      className="inline-flex items-center gap-3"
    >
      <BrandMark />
      <span
        className={`flex flex-col text-base font-bold leading-tight tracking-tight sm:text-lg ${
          light ? "text-white" : "text-slate-950"
        }`}
      >
        <span>Techabanca</span>
        <span
          className={`text-[10px] uppercase tracking-[0.2em] ${
            light ? "text-lime-300" : "text-emerald-800"
          }`}
        >
          Billing
        </span>
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-lg transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 ${
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

function SectionLabel({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] ${
        light ? "text-lime-300" : "text-emerald-800"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
      {children}
    </div>
  );
}

function ScreenshotFrame({
  src,
  alt,
  label,
  caption,
  imageClassName = "",
  lightToolbar = false,
}: {
  src: string;
  alt: string;
  label: string;
  caption?: string;
  imageClassName?: string;
  lightToolbar?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.55)]">
      <div
        className={`flex min-h-11 items-center justify-between gap-4 px-4 text-[9px] font-bold uppercase tracking-[0.16em] sm:px-5 sm:text-[10px] ${
          lightToolbar
            ? "bg-emerald-950 text-emerald-100"
            : "bg-slate-950 text-slate-200"
        }`}
      >
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <i className="h-1.5 w-1.5 rounded-full bg-lime-300" />
          <i className="h-1.5 w-1.5 rounded-full bg-lime-300/70" />
          <i className="h-1.5 w-1.5 rounded-full bg-lime-300/40" />
        </span>
        <span>{label}</span>
      </div>

      <div className="overflow-hidden bg-[#eef3ef]">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`block w-full ${imageClassName}`}
        />
      </div>

      {caption && (
        <figcaption className="border-t border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5 sm:py-4 sm:text-sm">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div
      id="top"
      className="min-h-screen overflow-x-hidden bg-[#f5f7f2] text-slate-950"
    >
      <div className="relative overflow-hidden bg-[#071315] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-28 h-[32rem] w-[32rem] rounded-full bg-lime-300/[0.08] blur-[120px]" />
          <div className="absolute -right-40 -top-24 h-[36rem] w-[36rem] rounded-full bg-emerald-500/[0.12] blur-[140px]" />
          <div
            className="absolute inset-0 opacity-[0.045]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        </div>

        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#071315]/90 text-white backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:px-10">
            <Brand light />

            <nav
              className="hidden items-center justify-center gap-7 whitespace-nowrap text-sm font-medium text-slate-300 lg:flex"
              aria-label="Main navigation"
            >
              <a href="#product" className="transition hover:text-white">
                Product
              </a>
              <a href="#workflow" className="transition hover:text-white">
                Workflow
              </a>
              <a href="#invoicing" className="transition hover:text-white">
                Invoicing
              </a>
              <a href="#expenses" className="transition hover:text-white">
                Expenses
              </a>
              <a href="#pricing" className="transition hover:text-white">
                Pricing
              </a>
              <a href="#faq" className="transition hover:text-white">
                FAQs
              </a>
            </nav>

            <div className="hidden items-center justify-end gap-3 lg:flex">
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-semibold text-white transition hover:text-lime-200"
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
              className="justify-self-end rounded-lg border border-white/20 p-2 text-white lg:hidden"
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
              className="border-t border-white/10 bg-[#071315] px-5 pb-5 pt-3 lg:hidden"
            >
              <div className="flex flex-col gap-1">
                {[
                  ["#product", "Product"],
                  ["#workflow", "Workflow"],
                  ["#invoicing", "Invoicing"],
                  ["#expenses", "Expenses"],
                  ["#pricing", "Pricing"],
                  ["#faq", "FAQs"],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    className="rounded-lg px-3 py-3 text-sm text-slate-200 hover:bg-white/10"
                  >
                    {label}
                  </a>
                ))}

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

        <main className="relative">
          <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-32 sm:px-8 sm:pt-36 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:px-10 lg:pb-28 lg:pt-44">
            <div className="relative z-10 max-w-2xl">
              <SectionLabel light>
                Invoicing • Purchases • Expenses • Reports
              </SectionLabel>

              <h1 className="mt-7 text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[4.7rem]">
                Run the business.
                <span className="mt-2 block font-serif font-normal italic tracking-[-0.045em] text-lime-300">
                  Keep the records clear.
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                Bring invoices, purchases, customers, products, payments,
                expenses, and reporting into one practical Techabanca Billing
                workspace.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <PrimaryLink>Start with Techabanca Billing</PrimaryLink>

                <a
                  href="#product"
                  className="inline-flex items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-white transition hover:text-lime-200"
                >
                  See the product
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Check size={16} className="text-lime-300" />
                  Connected business records
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={16} className="text-lime-300" />
                  Responsive web workspace
                </span>
              </div>
            </div>

            <div className="relative lg:translate-x-6">
              <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-lime-300/[0.08] blur-3xl" />

              <div className="relative rotate-0 lg:rotate-[1deg]">
                <ScreenshotFrame
                  src="/marketing/billing/dashboard.png"
                  alt="Techabanca Billing dashboard showing business performance and activity"
                  label="Techabanca Billing / Dashboard"
                  imageClassName="aspect-[4/3] object-cover object-top sm:aspect-[16/11]"
                  caption="A real Techabanca Billing workspace — business performance, billing activity, and records brought together."
                />
              </div>

              <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-white/15 bg-[#102222]/95 px-4 py-3 shadow-2xl backdrop-blur md:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300">
                  One workspace
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Billing → Collections → Expenses → Reports
                </p>
              </div>
            </div>
          </section>

          <div className="border-y border-white/10 bg-white/[0.025]">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-6 lg:px-10">
              {[
                "Invoices",
                "Purchases",
                "Customers",
                "Products",
                "Expenses",
                "Reports",
              ].map((item) => (
                <div
                  key={item}
                  className="flex min-h-16 items-center justify-center border-white/10 px-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300 lg:border-r"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <section
        id="product"
        className="scroll-mt-20 bg-[#eef3ec] px-5 py-20 sm:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.7fr]">
            <div className="max-w-3xl">
              <SectionLabel>Your business at a glance</SectionLabel>

              <h2 className="mt-5 text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                See the work.
                <span className="block font-serif font-normal italic text-emerald-800">
                  See what needs attention.
                </span>
              </h2>
            </div>

            <p className="max-w-xl text-base leading-7 text-slate-600 lg:justify-self-end">
              Techabanca Billing turns the records you create every day into a
              clearer view of business activity, payments, purchases, expenses,
              and outstanding work.
            </p>
          </div>

          <div className="relative mt-12 lg:mt-16">
            <div className="absolute -inset-4 z-0 rounded-[2rem] bg-emerald-900/[0.04]" />

            <div className="relative">
              <ScreenshotFrame
                src="/marketing/billing/dashboard.png"
                alt="Full Techabanca Billing dashboard"
                label="Live product view / Dashboard"
                imageClassName="aspect-[5/4] object-cover object-top sm:aspect-[16/9]"
              />
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Sales", "Keep invoiced business visible."],
              ["Collections", "Record what has been received."],
              ["Outstanding", "See what still needs attention."],
              ["Activity", "Review business performance in context."],
            ].map(([title, description], index) => (
              <article
                key={title}
                className="border border-emerald-900/10 bg-white/80 p-5"
              >
                <span className="text-[10px] font-black tracking-[0.18em] text-emerald-800">
                  0{index + 1}
                </span>
                <h3 className="mt-7 text-xl font-bold tracking-tight">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-20 bg-[#0a1719] px-5 py-20 text-white sm:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="lg:self-start">
              <SectionLabel light>One connected workflow</SectionLabel>

              <h2 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-5xl">
                From the record
                <span className="block font-serif font-normal italic text-lime-300">
                  to the bigger picture.
                </span>
              </h2>

              <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
                The value is not in another isolated form. It is in keeping the
                documents, payments, expenses, and business visibility close to
                the same daily workflow.
              </p>
            </div>

            <div className="border-t border-white/15">
              {workflow.map((step) => (
                <article
                  key={step.number}
                  className="grid gap-5 border-b border-white/15 py-8 sm:grid-cols-[70px_1fr] sm:py-10"
                >
                  <span className="text-xs font-black tracking-[0.2em] text-lime-300">
                    {step.number}
                  </span>

                  <div>
                    <h3 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="invoicing"
        className="scroll-mt-20 bg-white px-5 py-20 sm:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.76fr]">
            <div className="max-w-3xl">
              <SectionLabel>Invoicing</SectionLabel>
              <h2 className="mt-5 text-4xl font-extrabold leading-[1.03] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                From draft to PDF.
                <span className="block font-serif font-normal italic text-emerald-800">
                  Keep the trail connected.
                </span>
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-slate-600 lg:justify-self-end">
              Create the invoice, reuse customer and product records, apply tax
              and charges, generate the finished document, and keep payments
              tied back to the same sale.
            </p>
          </div>

          <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:gap-8">
            <ScreenshotFrame
              src="/marketing/billing/invoice-create.png"
              alt="Techabanca Billing new tax invoice screen with customer details, line items, tax, charges, and totals"
              label="Techabanca Billing / New Tax Invoice"
              imageClassName="aspect-[4/3] object-cover object-top sm:aspect-[16/10]"
              caption="Build a GST-ready invoice using saved business records, line items, tax, charges, notes, and totals."
            />

            <figure className="overflow-hidden rounded-[1.35rem] border border-emerald-950/10 bg-[#f7f9f5] shadow-[0_30px_90px_-35px_rgba(15,23,42,0.38)]">
              <div className="flex min-h-11 items-center justify-between gap-4 bg-emerald-950 px-4 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-100 sm:px-5 sm:text-[10px]">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <i className="h-1.5 w-1.5 rounded-full bg-lime-300" />
                  <i className="h-1.5 w-1.5 rounded-full bg-lime-300/70" />
                  <i className="h-1.5 w-1.5 rounded-full bg-lime-300/40" />
                </span>
                <span>Generated Tax Invoice / PDF</span>
              </div>
              <div className="bg-[#eef3ef] p-3 sm:p-4">
                <img
                  src="/marketing/billing/invoice-pdf.png"
                  alt="Generated Techabanca Billing tax invoice PDF"
                  loading="lazy"
                  className="mx-auto block h-auto w-full max-w-[520px] bg-white shadow-sm"
                />
              </div>
              <figcaption className="border-t border-emerald-950/10 bg-white px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5 sm:py-4 sm:text-sm">
                The finished document carries the customer, items, GST,
                totals, payment status, and business payment details into a
                professional printable invoice.
              </figcaption>
            </figure>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Customer + document", "Reuse customer details and maintain the core invoice information together."],
              ["02", "Items + tax", "Add products or services, quantities, rates, discounts, GST, and supported charges."],
              ["03", "Issue + download", "Move the sale into an issued document and download the generated PDF."],
              ["04", "Payment trail", "Record received amounts, including partial payments, and keep the remaining balance visible."],
            ].map(([number, title, description]) => (
              <article key={number} className="bg-[#f8faf7] p-5 sm:p-6">
                <span className="text-[10px] font-black tracking-[0.2em] text-emerald-800">{number}</span>
                <h3 className="mt-7 text-lg font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="expenses"
        className="scroll-mt-20 bg-[#dfeadf] px-5 py-20 sm:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <SectionLabel>Expenses</SectionLabel>

              <h2 className="mt-5 text-4xl font-extrabold leading-[1.03] tracking-[-0.05em] sm:text-5xl">
                Every cost deserves
                <span className="block font-serif font-normal italic text-emerald-800">
                  a proper record.
                </span>
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-700">
                Record day-to-day expenses, keep them categorized, and make
                expense activity part of the same business workspace instead
                of another disconnected spreadsheet.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  "Expense categories",
                  "Vendor-linked records",
                  "Payment methods",
                  "Recurring expenses",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 border border-emerald-900/10 bg-white/60 px-4 py-4 text-sm font-semibold"
                  >
                    <Check
                      size={17}
                      className="shrink-0 text-emerald-700"
                      aria-hidden="true"
                    />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <ScreenshotFrame
              src="/marketing/billing/expenses.png"
              alt="Techabanca Billing expenses page showing filters, categories, payment methods, and expense records"
              label="Techabanca Billing / Expenses"
              imageClassName="aspect-[4/3] object-cover object-top sm:h-auto sm:aspect-auto sm:object-contain"
              caption="Filter and review expense records without losing the context around them."
              lightToolbar
            />
          </div>
        </div>
      </section>

      <section className="bg-[#102323] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div className="mx-auto w-full max-w-[520px]">
            <ScreenshotFrame
              src="/marketing/billing/expense-reports.png"
              alt="Techabanca Billing expense reports with totals, charts, category analysis, and recurring expense projections"
              label="Techabanca Billing / Expense Reports"
              imageClassName="h-auto object-contain"
              caption="Recorded expenses and projected recurring costs are presented separately for clearer analysis."
            />
          </div>

          <div className="max-w-2xl">
            <SectionLabel light>Reporting</SectionLabel>

            <h2 className="mt-5 text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Know where the money
              <span className="block font-serif font-normal italic text-lime-300">
                is going.
              </span>
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-300 sm:text-lg">
              Review recorded expenses, category breakdowns, trends, and
              projected recurring costs without mixing future expectations
              with expenses that have already been recorded.
            </p>

            <div className="mt-10 grid gap-px overflow-hidden border border-white/15 bg-white/15 sm:grid-cols-2">
              {[
                ["Recorded totals", "Understand what has already been entered."],
                ["Category analysis", "See how expenses are distributed."],
                ["Trends", "Review movement across your selected period."],
                [
                  "Recurring projections",
                  "Keep upcoming recurring costs visible separately.",
                ],
              ].map(([title, description]) => (
                <div key={title} className="bg-[#102323] p-6">
                  <BarChart3
                    size={20}
                    className="text-lime-300"
                    aria-hidden="true"
                  />
                  <h3 className="mt-7 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f7f2] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.75fr]">
            <div className="max-w-3xl">
              <SectionLabel>The essentials, connected</SectionLabel>

              <h2 className="mt-5 text-4xl font-extrabold leading-[1.03] tracking-[-0.05em] sm:text-5xl">
                More of the daily work.
                <span className="block font-serif font-normal italic text-emerald-800">
                  Less jumping between tools.
                </span>
              </h2>
            </div>

            <p className="text-base leading-7 text-slate-600 lg:justify-self-end">
              Use the modules you need while keeping the underlying business
              records part of one Techabanca Billing workspace.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group bg-white p-5 transition hover:bg-[#f0f6ea] sm:min-h-64 sm:p-8"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    <span className="text-[10px] font-black tracking-[0.18em] text-slate-400">
                      0{index + 1}
                    </span>
                  </div>

                  <h3 className="mt-7 text-xl font-bold tracking-[-0.04em] sm:mt-14 sm:text-2xl">
                    {feature.title}
                  </h3>

                  <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#081416] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          <div>
            <SectionLabel light>Desktop to mobile</SectionLabel>

            <h2 className="mt-5 text-4xl font-extrabold leading-[1.03] tracking-[-0.05em] sm:text-5xl">
              Your workspace
              <span className="block font-serif font-normal italic text-lime-300">
                follows your screen.
              </span>
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
              Techabanca Billing is a responsive web workspace designed to stay
              usable as the available screen changes — from larger desktop
              views to compact mobile browsing.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              {["Responsive layout", "Touch-friendly navigation", "Same workspace"].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-slate-300"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="relative min-h-[360px] sm:min-h-[560px]">
            <div className="absolute left-0 top-0 hidden w-[88%] sm:block">
              <ScreenshotFrame
                src="/marketing/billing/dashboard.png"
                alt="Techabanca Billing dashboard displayed in a desktop-style frame"
                label="Desktop workspace"
                imageClassName="aspect-[16/10] object-cover object-top"
              />
            </div>

            <div className="relative mx-auto w-[68%] min-w-[180px] max-w-[240px] rounded-[2rem] border-[7px] border-slate-900 bg-slate-900 p-1 shadow-2xl sm:absolute sm:bottom-0 sm:right-0 sm:mx-0 sm:w-[42%] sm:min-w-[150px] sm:max-w-[250px]">
              <div className="overflow-hidden rounded-[1.35rem] bg-white">
                <div className="flex h-7 items-center justify-center bg-slate-950">
                  <span className="h-1.5 w-12 rounded-full bg-white/20" />
                </div>
                <img
                  src="/marketing/billing/mobile-dashboard.png"
                  alt="Real Techabanca Billing dashboard rendered in a mobile viewport"
                  loading="lazy"
                  className="aspect-[9/17] w-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="bg-white px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <SectionLabel>Getting started</SectionLabel>

              <h2 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.04] tracking-[-0.05em] sm:text-5xl">
                A short path from sign-up
                <span className="block font-serif font-normal italic text-emerald-800">
                  to real work.
                </span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                [
                  "01",
                  "Create your account",
                  "Enter the account and business details needed for your workspace.",
                ],
                [
                  "02",
                  "Choose a plan",
                  "Sign in and select one of the currently available billing options.",
                ],
                [
                  "03",
                  "Start working",
                  "Create records, documents, expenses, and begin reviewing business activity.",
                ],
              ].map(([number, title, description]) => (
                <article
                  key={number}
                  className="border border-slate-200 bg-[#f7f9f5] p-6"
                >
                  <span className="text-[10px] font-black tracking-[0.2em] text-emerald-800">
                    {number}
                  </span>
                  <h3 className="mt-12 text-xl font-bold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-20 bg-[#eef3ec] px-5 py-20 sm:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <SectionLabel>FAQs</SectionLabel>
            <h2 className="mt-5 text-4xl font-extrabold leading-[1.04] tracking-[-0.05em] sm:text-5xl">
              Questions before
              <span className="block font-serif font-normal italic text-emerald-800">
                getting started?
              </span>
            </h2>
          </div>

          <div className="border-t border-slate-300">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group border-b border-slate-300 py-1"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left text-base font-bold [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown
                    size={19}
                    aria-hidden="true"
                    className="shrink-0 text-emerald-800 transition group-open:rotate-180"
                  />
                </summary>

                <p className="max-w-2xl pb-6 pr-8 text-sm leading-7 text-slate-600">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-lime-300 px-5 py-20 text-slate-950 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-950">
              Your business. One workspace.
            </p>

            <h2 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Give the records a place.
              <span className="block font-serif font-normal italic text-emerald-950/75">
                Give yourself a clearer view.
              </span>
            </h2>
          </div>

          <PrimaryLink dark>Start with Techabanca Billing</PrimaryLink>
        </div>
      </section>

      <footer className="bg-[#061113] px-5 pb-10 pt-14 text-slate-400 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
            <div>
              <Brand light />
              <p className="mt-5 max-w-xs text-sm leading-6 text-slate-500">
                Practical billing and business records in one connected
                workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <strong className="text-[10px] uppercase tracking-[0.18em] text-slate-600">
                Product
              </strong>
              <a href="#product" className="hover:text-white">
                Product
              </a>
              <a href="#expenses" className="hover:text-white">
                Expenses
              </a>
              <a href="#pricing" className="hover:text-white">
                Pricing
              </a>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <strong className="text-[10px] uppercase tracking-[0.18em] text-slate-600">
                Account
              </strong>
              <Link to="/login" className="hover:text-white">
                Sign in
              </Link>
              <Link to="/register" className="hover:text-white">
                Create account
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-7 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} Techabanca Billing. All rights
              reserved.
            </p>
            <p>Built for clearer business records.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
