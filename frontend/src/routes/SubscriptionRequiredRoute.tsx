import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentSubscription } from "../services/subscriptionApi";
import SubscriptionCheckingScreen from "../components/SubscriptionCheckingScreen";

type SubscriptionCheckState = "LOADING" | "ACTIVE" | "INACTIVE" | "ERROR";

export default function SubscriptionRequiredRoute() {
  const [state, setState] = useState<SubscriptionCheckState>("LOADING");

  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkSubscription() {
      try {
        setState("LOADING");

        const result = await getCurrentSubscription();

        if (cancelled) {
          return;
        }

        setState(result.has_active_subscription ? "ACTIVE" : "INACTIVE");
      } catch {
        if (!cancelled) {
          setState("ERROR");
        }
      }
    }

    void checkSubscription();

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  if (status === "LOADING") {
    return <SubscriptionCheckingScreen />;
  }

  if (state === "INACTIVE") {
    return <Navigate to="/subscribe" replace />;
  }

  if (state === "ERROR") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Unable to verify subscription
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Taxlume could not verify your subscription status. Please try again.
          </p>

          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
