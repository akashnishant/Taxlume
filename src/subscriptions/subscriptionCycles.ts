export type BillingInterval =
    | "MONTHLY"
    | "QUARTERLY"
    | "HALF_YEARLY"
    | "ANNUAL";

/**
 * Razorpay requires a finite total_count.
 *
 * Techabanca Billing treats subscriptions as ongoing until cancelled,
 * so we use Razorpay's documented maximum duration of
 * approximately 100 years.
 */
export function getSubscriptionTotalCount(
    billingInterval: BillingInterval,
): number {
    switch (billingInterval) {
        case "MONTHLY":
            return 1200;

        case "QUARTERLY":
            return 400;

        case "HALF_YEARLY":
            return 200;

        case "ANNUAL":
            return 100;
    }
}