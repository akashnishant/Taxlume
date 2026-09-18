import api from "./api";

export type BillingInterval =
  | "MONTHLY"
  | "QUARTERLY"
  | "HALF_YEARLY"
  | "ANNUAL";

export type SubscriptionStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";

export type SubscriptionPrice = {
  id: string;
  billing_interval: BillingInterval;
  amount_paise: number;
  currency_code: string;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  prices: SubscriptionPrice[];
};

export type SubscriptionPlanListResponse = {
  success: boolean;
  plans: SubscriptionPlan[];
};

export type CurrentSubscription = {
  id: string;

  plan: {
    id: string;
    code: string;
    name: string;
  };

  price_id: string;

  billing_interval: BillingInterval;
  status: SubscriptionStatus;

  amount_paise: number;
  currency_code: string;

  current_period_start: string | null;
  current_period_end: string | null;

  cancel_at_period_end: boolean;

  created_at: string;
  updated_at: string;
};

export type CurrentSubscriptionResponse = {
  success: boolean;
  has_active_subscription: boolean;
  subscription: CurrentSubscription | null;
};

export type SubscriptionCheckoutResponse = {
  success: boolean;

  checkout: {
    subscription_id: string;

    provider: "RAZORPAY";
    provider_subscription_id: string;
    provider_key_id: string;

    price_id: string;
    billing_interval: BillingInterval;

    amount_paise: number;
    currency_code: string;

    plan_name: string;
  };
};

export type SubscriptionReconcileResponse = {
  success: boolean;
  applied: boolean;
  provider_status: string;

  subscription: {
    id: string;
    status: SubscriptionStatus;
    current_period_start: string | null;
    current_period_end: string | null;
  };
};

export async function getSubscriptionPlans(): Promise<
  SubscriptionPlan[]
> {
  const response =
    await api.get<SubscriptionPlanListResponse>(
      "/api/subscription-plans",
    );

  return response.data.plans;
}

export async function getCurrentSubscription(): Promise<
  CurrentSubscriptionResponse
> {
  const response =
    await api.get<CurrentSubscriptionResponse>(
      "/api/subscriptions/current",
    );

  return response.data;
}

export async function createSubscriptionCheckout(
  priceId: string,
): Promise<SubscriptionCheckoutResponse> {
  const response =
    await api.post<SubscriptionCheckoutResponse>(
      "/api/subscriptions/checkout",
      {
        price_id: priceId,
      },
    );

  return response.data;
}

export async function reconcileSubscription(): Promise<
  SubscriptionReconcileResponse
> {
  const response =
    await api.post<SubscriptionReconcileResponse>(
      "/api/subscriptions/reconcile",
    );

  return response.data;
}