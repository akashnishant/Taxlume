import { Loader2 } from "lucide-react";

export default function SubscriptionCheckingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="text-center">
        <Loader2 size={30} className="mx-auto animate-spin text-slate-500" />

        <p className="mt-3 text-sm text-slate-500">
          Checking your Taxlume subscription...
        </p>
      </div>
    </div>
  );
}
