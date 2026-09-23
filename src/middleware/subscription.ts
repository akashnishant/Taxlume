import { createMiddleware } from "hono/factory";

type ActiveSubscriptionRow = {
    id: string;
    current_period_start: string;
    current_period_end: string;
};

export const subscriptionMiddleware =
    createMiddleware<{
        Bindings: Env;
    }>(async (c, next) => {
        const companyId = c.get("companyId");

        if (!companyId) {
            return c.json(
                {
                    success: false,
                    code: "AUTHENTICATION_CONTEXT_MISSING",
                    message:
                        "Authentication context is missing",
                },
                401,
            );
        }

        const now = new Date().toISOString();

        const subscription = await c.env.DB
            .prepare(`
                SELECT
                    id,
                    current_period_start,
                    current_period_end
                FROM company_subscriptions
                WHERE company_id = ?
                    AND status = 'ACTIVE'
                    AND current_period_start IS NOT NULL
                    AND current_period_end IS NOT NULL
                    AND current_period_start <= ?
                    AND current_period_end > ?
                ORDER BY current_period_end DESC
                LIMIT 1
            `)
            .bind(
                companyId,
                now,
                now,
            )
            .first<ActiveSubscriptionRow>();

        if (!subscription) {
            return c.json(
                {
                    success: false,
                    code: "SUBSCRIPTION_REQUIRED",
                    message:
                        "An active Techabanca Billing subscription is required.",
                },
                402,
            );
        }

        await next();
    });