import {
  BadgeCheck,
  FileCheck2,
  FileDown,
  FilePlus2,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

const capabilities = [
  {
    icon: FilePlus2,
    title: "Generate from your invoice",
    description:
      "Start an E-Way Bill from an issued sales document with business, customer, item and tax details already filled in.",
  },
  {
    icon: RefreshCw,
    title: "Government sync",
    description:
      "Keep the E-Way Bill number, validity and latest status connected to the related billing document.",
  },
  {
    icon: Truck,
    title: "Transport & Part B",
    description:
      "Add transporter, vehicle and movement details without re-entering the invoice information.",
  },
  {
    icon: FileDown,
    title: "Download together",
    description:
      "Download the E-Way Bill PDF on its own or together with the Techabanca invoice as one document pack.",
  },
];

const workflow = [
  "Choose an eligible issued invoice",
  "Review the auto-filled invoice and GST details",
  "Add the required transport information",
  "Generate and sync the official E-Way Bill",
];

export default function EWayBillComingSoon() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-10 lg:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"
        />

        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-lime-200">
                <Sparkles size={14} />
                Coming Soon
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                Integration in progress
              </span>
            </div>

            <p className="mb-2 text-sm font-semibold text-lime-200">
              Techabanca Billing
            </p>

            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-[42px] lg:leading-[1.08]">
              E-Way Bill, without entering the same invoice twice.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              We are building a connected E-Way Bill workflow so eligible
              businesses can move from an issued invoice to transport details,
              government generation and document download from one place.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-slate-200">
                <BadgeCheck size={16} className="text-lime-300" />
                Invoice details auto-filled
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-slate-200">
                <ShieldCheck size={16} className="text-lime-300" />
                Secure provider integration
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Planned workflow
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    Invoice → E-Way Bill
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-300 text-slate-950">
                  <Route size={22} />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {workflow.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-slate-900/60 p-3.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-300 text-xs font-black text-slate-950">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-sm leading-5 text-slate-200">
                      {step}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300" />
                <span>
                  The government system remains the source of truth for
                  generated E-Way Bills.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              What we are building
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              A faster compliance workflow
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-6 text-slate-500 sm:text-right">
            Reuse what is already available in Techabanca Billing and enter
            only the transport information that is still needed.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {capabilities.map((capability) => {
            const Icon = capability.icon;

            return (
              <article
                key={capability.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-emerald-900">
                  <Icon size={20} />
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  {capability.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {capability.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.82fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lime-300">
              <FileCheck2 size={21} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Planned document experience
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                E-Way Bill status beside your sales document
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Once released, the related invoice will be able to show the
                E-Way Bill number, generation status and validity information
                without requiring a separate record to be maintained manually.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["E-Way Bill No.", "Auto-linked"],
                  ["Status", "Government synced"],
                  ["PDF", "Ready to download"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <p className="text-xs font-medium text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-100">
            <ShieldCheck size={20} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-slate-950">
            Built carefully before we switch it on
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            The integration is being prepared and tested before it is made
            available inside Billing. Until then, your existing invoice and
            manual E-Way Bill number workflow continues to work as it does
            today.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100">
            <Sparkles size={14} />
            No setup is required yet
          </div>
        </article>
      </section>
    </main>
  );
}
