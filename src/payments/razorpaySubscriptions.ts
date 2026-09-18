import { razorpayRequest } from "./razorpayClient";

export type RazorpaySubscriptionStatus =
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "cancelled"
    | "completed"
    | "expired";

export type RazorpaySubscription = {
    id: string;
    entity: "subscription";
    plan_id: string;
    status: RazorpaySubscriptionStatus;

    current_start: number | null;
    current_end: number | null;
    ended_at: number | null;

    quantity: number;

    charge_at: number | null;
    start_at: number | null;
    end_at: number | null;

    total_count: number;
    paid_count: number;
    remaining_count: number;

    customer_notify: boolean;

    created_at: number;

    expire_by: number | null;
    short_url: string | null;

    notes:
        | Record<string, string>
        | null;
};

type CreateRazorpaySubscriptionInput = {
    planId: string;
    totalCount: number;
    customerNotify?: boolean;
    notes?: Record<string, string>;
};

export async function createRazorpaySubscription(
    env: Env,
    input: CreateRazorpaySubscriptionInput,
): Promise<RazorpaySubscription> {
    return razorpayRequest<RazorpaySubscription>(
        env,
        "/subscriptions",
        {
            method: "POST",

            body: JSON.stringify({
                plan_id: input.planId,
                total_count: input.totalCount,
                quantity: 1,

                customer_notify:
                    input.customerNotify ??
                    false,

                notes:
                    input.notes,
            }),
        },
    );
}

export async function fetchRazorpaySubscription(
    env: Env,
    subscriptionId: string,
): Promise<RazorpaySubscription> {
    return razorpayRequest<RazorpaySubscription>(
        env,
        `/subscriptions/${encodeURIComponent(
            subscriptionId,
        )}`,
        {
            method: "GET",
        },
    );
}