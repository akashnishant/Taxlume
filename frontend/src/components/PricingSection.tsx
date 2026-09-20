import { useEffect, useState } from "react";
import { ArrowRight, Check, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import {
  getSubscriptionPlans,
  type BillingInterval,
  type SubscriptionPlan,
  type SubscriptionPrice,
} from "../services/subscriptionApi";

const intervalDetails: Record<
  BillingInterval,
  { label: string; suffix: string }
> = {
  MONTHLY: {
    label: "Monthly",
    suffix: "/ month",
  },
  QUARTERLY: {
    label: "Quarterly",
    suffix: "/ 3 months",
  },
  HALF_YEARLY: {
    label: "Half-yearly",
    suffix: "/ 6 months",
  },
  ANNUAL: {
    label: "Annual",
    suffix: "/ year",
  },
};

const intervalOrder: BillingInterval[] = [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
];

const includedCapabilities = [
  "Sales invoices and quotations",
  "Purchase orders",
  "Customer and vendor records",
  "Products and services",
  "Invoice payment tracking",
  "Business dashboard and reports",
];

function formatMoney(amountPaise: number, currencyCode: string): string {
  const amount = amountPaise / 100;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: amountPaise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getAnnualSaving(
  plan: SubscriptionPlan,
): { amountPaise: number; currencyCode: string } | null {
  const monthly = plan.prices.find(
    (price) => price.billing_interval === "MONTHLY",
  );

  const annual = plan.prices.find(
    (price) => price.billing_interval === "ANNUAL",
  );

  if (!monthly || !annual || monthly.currency_code !== annual.currency_code) {
    return null;
  }

  const amountPaise = monthly.amount_paise * 12 - annual.amount_paise;

  return amountPaise > 0
    ? {
        amountPaise,
        currencyCode: annual.currency_code,
      }
    : null;
}

function PriceOption({ price }: { price: SubscriptionPrice }) {
  const interval = intervalDetails[price.billing_interval];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <p className="text-sm font-semibold text-slate-700">{interval.label}</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
          {formatMoney(price.amount_paise, price.currency_code)}
        </span>

        <span className="text-sm text-slate-500">{interval.suffix}</span>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Billed {interval.label.toLowerCase()}
      </p>
    </div>
  );
}

export default function PricingSection() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPricing() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getSubscriptionPlans();

        if (active) {
          setPlans(result);
        }
      } catch {
        if (active) {
          setPlans([]);
          setError(
            "We couldn't load the current subscription prices. Please try again.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadPricing();

    return () => {
      active = false;
    };
  }, [retryKey]);

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-24 bg-slate-100 px-5 py-20 sm:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            Pricing
          </span>

          <h2
            id="pricing-heading"
            className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl"
          >
            Find a billing option for your business.
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600">
            Review Taxlume's currently available plans and billing intervals.
            Create your account to choose a subscription and continue to
            payment.
          </p>
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-12 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"
          >
            <span
              aria-hidden="true"
              className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"
            />

            <p className="mt-5 text-sm font-semibold text-slate-800">
              Loading current pricing...
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Checking available Taxlume plans and billing options.
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mx-auto mt-12 max-w-2xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm"
          >
            <p className="text-sm font-medium text-slate-700">{error}</p>

            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-700">
              Subscription plans are not currently available to display.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Please check back later for the current options.
            </p>
          </div>
        ) : (
          <>
            <div
              className={`mt-12 grid items-stretch gap-6 ${
                plans.length === 1 ? "mx-auto max-w-2xl" : "lg:grid-cols-2"
              }`}
            >
              {plans.map((plan) => {
                const saving = getAnnualSaving(plan);

                const prices = [...plan.prices].sort(
                  (a, b) =>
                    intervalOrder.indexOf(a.billing_interval) -
                    intervalOrder.indexOf(b.billing_interval),
                );

                return (
                  <article
                    key={plan.id}
                    className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8"
                  >
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="text-2xl font-extrabold text-slate-950">
                          {plan.name}
                        </h3>

                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                          Subscription plan
                        </span>
                      </div>

                      {plan.description && (
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          {plan.description}
                        </p>
                      )}
                    </div>

                    {prices.length > 0 ? (
                      <div className="mt-7 grid gap-3 sm:grid-cols-2">
                        {prices.map((price) => (
                          <PriceOption key={price.id} price={price} />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-7 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                        No billing options are currently listed for this plan.
                      </p>
                    )}

                    {saving && (
                      <p className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                        Annual billing saves{" "}
                        {formatMoney(saving.amountPaise, saving.currencyCode)}{" "}
                        compared with 12 monthly payments.
                      </p>
                    )}

                    <div className="mt-auto pt-8">
                      <Link
                        to="/register"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      >
                        Get started
                        <ArrowRight size={17} aria-hidden="true" />
                      </Link>

                      <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                        Account creation does not activate a subscription.
                        Choose your billing option after registration and
                        sign-in.
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-950">
                Work with your business records in Taxlume
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Taxlume's workspace provides these capabilities. Any
                plan-specific terms or limits should be checked when selecting
                your subscription.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {includedCapabilities.map((capability) => (
                  <div
                    key={capability}
                    className="flex items-start gap-3 text-sm text-slate-700"
                  >
                    <Check
                      size={18}
                      className="mt-0.5 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                    <span>{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-6 text-slate-500">
          Prices are retrieved from Taxlume's current plan list. Available
          billing options may change. Review the subscription details and final
          payable amount before completing payment.
        </p>
      </div>
    </section>
  );
}
