import { razorpayRequest } from "./razorpayClient";

export type RazorpayPlan = {
    id: string;
    entity: "plan";
    interval: number;
    period:
        | "daily"
        | "weekly"
        | "monthly"
        | "quarterly"
        | "yearly";
    item: {
        id: string;
        name: string;
        description: string | null;
        amount: number;
        currency: string;
    };
    created_at: number;
};

type CreateRazorpayPlanInput = {
    name: string;
    description?: string | null;
    amountPaise: number;
    currencyCode: string;
    billingInterval:
        | "MONTHLY"
        | "QUARTERLY"
        | "HALF_YEARLY"
        | "ANNUAL";
};

function getRazorpaySchedule(
    billingInterval:
        CreateRazorpayPlanInput["billingInterval"],
): {
    period:
        | "monthly"
        | "quarterly"
        | "yearly";
    interval: number;
} {
    switch (billingInterval) {
        case "MONTHLY":
            return {
                period: "monthly",
                interval: 1,
            };

        case "QUARTERLY":
            return {
                period: "quarterly",
                interval: 1,
            };

        case "HALF_YEARLY":
            return {
                period: "monthly",
                interval: 6,
            };

        case "ANNUAL":
            return {
                period: "yearly",
                interval: 1,
            };
    }
}

export async function createRazorpayPlan(
    env: Env,
    input: CreateRazorpayPlanInput,
): Promise<RazorpayPlan> {
    const schedule =
        getRazorpaySchedule(
            input.billingInterval,
        );

    return razorpayRequest<RazorpayPlan>(
        env,
        "/plans",
        {
            method: "POST",

            body: JSON.stringify({
                period: schedule.period,
                interval: schedule.interval,

                item: {
                    name: input.name,
                    amount:
                        input.amountPaise,
                    currency:
                        input.currencyCode,
                    description:
                        input.description ??
                        undefined,
                },
            }),
        },
    );
}