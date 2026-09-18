import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createSubscriptionCheckout,
  getCurrentSubscription,
  getSubscriptionPlans,
  reconcileSubscription,
  type SubscriptionPlan,
  type SubscriptionPrice,
} from "../services/subscriptionApi";
import { clearAuthToken } from "../services/authStorage";
import { clearSession } from "../services/sessionStorage";
import { loadRazorpayCheckout } from "../payments/loadRazorpayCheckout";

function formatMoney(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export default function Subscribe() {
  const navigate = useNavigate();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const [selectedPriceId, setSelectedPriceId] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [isStartingPayment, setIsStartingPayment] = useState(false);

  const [paymentMessage, setPaymentMessage] = useState("");

  useEffect(() => {
    async function loadPlans() {
      try {
        setIsLoading(true);
        setError("");

        const data = await getSubscriptionPlans();

        setPlans(data);

        const firstPlan = data[0];

        const annualPrice = firstPlan?.prices.find(
          (price) => price.billing_interval === "ANNUAL",
        );

        const monthlyPrice = firstPlan?.prices.find(
          (price) => price.billing_interval === "MONTHLY",
        );

        setSelectedPriceId(annualPrice?.id ?? monthlyPrice?.id ?? "");
      } catch {
        setError(
          "Unable to load Taxlume subscription plans. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPlans();
  }, []);

  const selectedPrice = useMemo<SubscriptionPrice | null>(() => {
    for (const plan of plans) {
      const price = plan.prices.find((item) => item.id === selectedPriceId);

      if (price) {
        return price;
      }
    }

    return null;
  }, [plans, selectedPriceId]);

  async function handleContinueToPayment() {
    if (!selectedPrice) {
      return;
    }

    try {
      setIsStartingPayment(true);
      setError("");
      setPaymentMessage("");

      const result = await createSubscriptionCheckout(selectedPrice.id);

      await loadRazorpayCheckout();

      const Razorpay = window.Razorpay;

      if (!Razorpay) {
        throw new Error("Razorpay Checkout is unavailable.");
      }

      const checkout = new Razorpay({
        key: result.checkout.provider_key_id,

        subscription_id: result.checkout.provider_subscription_id,

        name: "Taxlume",

        description: `${result.checkout.plan_name} - ${
          result.checkout.billing_interval === "ANNUAL" ? "Annual" : "Monthly"
        }`,

        handler: async () => {
          try {
            setPaymentMessage(
              "Payment completed. Verifying your Taxlume subscription...",
            );

            /*
             * Razorpay may invoke the Checkout
             * success callback just before the
             * subscription entity becomes ACTIVE.
             *
             * Reconcile for a short bounded period
             * instead of relying solely on webhook
             * timing.
             */
            const maxAttempts = 6;

            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
              await reconcileSubscription();

              const current = await getCurrentSubscription();

              if (current.has_active_subscription) {
                setPaymentMessage("Subscription activated successfully.");

                navigate("/", {
                  replace: true,
                });

                return;
              }

              if (attempt < maxAttempts) {
                setPaymentMessage(
                  "Payment received. Activating your subscription...",
                );

                await delay(2000);
              }
            }

            /*
             * The payment may still have succeeded,
             * but provider activation can occasionally
             * take longer than our short verification
             * window.
             *
             * Keep the user on this page and allow a
             * retry rather than reporting the payment
             * as failed.
             */
            setPaymentMessage(
              "Payment was received, but subscription activation is still being confirmed. Please try again shortly.",
            );

            setIsStartingPayment(false);
          } catch (verificationError) {
            console.error(
              "Subscription verification failed",
              verificationError,
            );

            setPaymentMessage(
              "Payment was received, but Taxlume could not confirm the subscription yet. Please try again shortly.",
            );

            setIsStartingPayment(false);
          }
        },

        modal: {
          ondismiss: () => {
            setIsStartingPayment(false);
          },
        },
      });

      checkout.open();

      /*
       * Keep the button disabled while Razorpay
       * Checkout remains open.
       *
       * isStartingPayment is cleared by either
       * modal.ondismiss or the success flow above.
       */
    } catch (paymentError) {
      console.error("Unable to start subscription payment", paymentError);

      setIsStartingPayment(false);

      setError("Unable to start the payment process. Please try again.");
    }
  }

  function handleLogout() {
    clearAuthToken();
    clearSession();
    navigate("/login", {
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white shadow-lg">
            T
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">Taxlume</h1>

          <p className="mt-2 text-sm font-medium text-slate-600">
            Smart Billing for Growing Businesses
          </p>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            Choose your subscription
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Select a billing option to continue using Taxlume.
          </p>
        </div>

        {error && (
          <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={30} className="animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {plans.map((plan) => {
              const monthly = plan.prices.find(
                (price) => price.billing_interval === "MONTHLY",
              );

              const annual = plan.prices.find(
                (price) => price.billing_interval === "ANNUAL",
              );

              const annualSaving =
                monthly && annual
                  ? monthly.amount_paise * 12 - annual.amount_paise
                  : 0;

              return (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
                >
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {plan.name}
                    </h3>

                    {plan.description && (
                      <p className="mt-1 text-sm text-slate-500">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div className="mb-7 grid gap-4 sm:grid-cols-2">
                    {monthly && (
                      <button
                        type="button"
                        onClick={() => setSelectedPriceId(monthly.id)}
                        className={`rounded-xl border p-5 text-left transition ${
                          selectedPriceId === monthly.id
                            ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/10"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            Monthly
                          </span>

                          {selectedPriceId === monthly.id && (
                            <Check size={20} className="text-slate-900" />
                          )}
                        </div>

                        <div className="mt-4">
                          <span className="text-3xl font-bold text-slate-900">
                            {formatMoney(monthly.amount_paise)}
                          </span>

                          <span className="ml-1 text-sm text-slate-500">
                            / month
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          Flexible monthly billing.
                        </p>
                      </button>
                    )}

                    {annual && (
                      <button
                        type="button"
                        onClick={() => setSelectedPriceId(annual.id)}
                        className={`relative rounded-xl border p-5 text-left transition ${
                          selectedPriceId === annual.id
                            ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/10"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <div className="absolute -top-3 right-4 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                          Best value
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            Annual
                          </span>

                          {selectedPriceId === annual.id && (
                            <Check size={20} className="text-slate-900" />
                          )}
                        </div>

                        <div className="mt-4">
                          <span className="text-3xl font-bold text-slate-900">
                            {formatMoney(annual.amount_paise)}
                          </span>

                          <span className="ml-1 text-sm text-slate-500">
                            / year
                          </span>
                        </div>

                        {annualSaving > 0 && (
                          <p className="mt-2 text-sm font-medium text-emerald-700">
                            Save {formatMoney(annualSaving)} per year
                          </p>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="mb-7 rounded-xl bg-slate-50 p-4">
                    <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                      <div className="flex gap-2">
                        <Check
                          size={18}
                          className="shrink-0 text-emerald-600"
                        />
                        Sales invoices and quotations
                      </div>

                      <div className="flex gap-2">
                        <Check
                          size={18}
                          className="shrink-0 text-emerald-600"
                        />
                        Purchase orders
                      </div>

                      <div className="flex gap-2">
                        <Check
                          size={18}
                          className="shrink-0 text-emerald-600"
                        />
                        Customers and vendors
                      </div>

                      <div className="flex gap-2">
                        <Check
                          size={18}
                          className="shrink-0 text-emerald-600"
                        />
                        Products and services
                      </div>

                      <div className="flex gap-2">
                        <Check
                          size={18}
                          className="shrink-0 text-emerald-600"
                        />
                        GST-ready billing
                      </div>

                      <div className="flex gap-2">
                        <Check
                          size={18}
                          className="shrink-0 text-emerald-600"
                        />
                        Business reports
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedPrice || isStartingPayment}
                    onClick={handleContinueToPayment}
                    className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isStartingPayment ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {paymentMessage
                          ? "Confirming subscription..."
                          : "Starting payment..."}
                      </span>
                    ) : (
                      "Continue to payment"
                    )}
                  </button>

                  {paymentMessage ? (
                    <p className="mt-3 text-center text-sm font-medium text-emerald-700">
                      {paymentMessage}
                    </p>
                  ) : (
                    <p className="mt-3 text-center text-xs text-slate-400">
                      Secure payment powered by Razorpay.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Taxlume
        </p>
      </div>
    </div>
  );
}
