import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareConditionalRecurringAudit } from "../utils/expenses/prepareConditionalRecurringAudit";

const RecurringExpenseStatusRequest =
    z.object({
        is_active:
            z.boolean(),
    });

type RuleRow = {
    id: string;
    name: string;
    is_active: number;
    next_run_date: string;
    last_run_date: string | null;
    end_date: string | null;
    updated_at: string;
};

export class RecurringExpenseStatus
    extends OpenAPIRoute {

    schema = {
        tags: ["Recurring Expenses"],

        summary:
            "Activate or deactivate a recurring expense rule",

        request: {
            params: z.object({
                id:
                    z.string().uuid(),
            }),

            body: {
                content: {
                    "application/json": {
                        schema:
                            RecurringExpenseStatusRequest,
                    },
                },
            },
        },

        responses: {
            "200": {
                description:
                    "Recurring expense rule status updated successfully",
            },

            "400": {
                description:
                    "Invalid recurring expense rule ID",
            },

            "401": {
                description:
                    "Authentication required",
            },

            "404": {
                description:
                    "Recurring expense rule not found",
            },
            "409": {
                description: "Recurring expense rule changed; reload and retry",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId =
            c.get("companyId");

        const userId =
            c.get("userId");

        const id =
            c.req.param("id");

        if (!companyId || !userId) {
            return c.json(
                {
                    success: false,
                    message:
                        "Authentication context is missing",
                },
                401,
            );
        }

        if (
            !id ||
            !z.string()
                .uuid()
                .safeParse(id)
                .success
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Invalid recurring expense rule ID",
                },
                400,
            );
        }

        const data =
            await this.getValidatedData<
                typeof this.schema
            >();

        const requestedActive =
            data.body.is_active
                ? 1
                : 0;

        const existing =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        name,
                        is_active,
                        next_run_date,
                        end_date,
                        last_run_date,
                        updated_at

                    FROM recurring_expense_rules

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL

                    LIMIT 1
                `)
                .bind(
                    id,
                    companyId,
                )
                .first<RuleRow>();

        if (!existing) {
            return c.json(
                {
                    success: false,
                    message:
                        "Recurring expense rule not found",
                },
                404,
            );
        }

        /*
         * No-op status requests succeed without creating
         * unnecessary database writes or audit entries.
         */
        if (
            existing.is_active ===
            requestedActive
        ) {
            return c.json({
                success: true,

                message:
                    requestedActive === 1
                        ? "Recurring expense rule is already active"
                        : "Recurring expense rule is already inactive",

                recurring_expense: {
                    id:
                        existing.id,

                    is_active:
                        existing.is_active,

                    next_run_date:
                        existing.next_run_date,

                    end_date:
                        existing.end_date,
                },
            });
        }

        const now =
            new Date().toISOString();

        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE recurring_expense_rules

                    SET
                        is_active = ?,
                        updated_by = ?,
                        updated_at = ?

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL
                      AND updated_at = ?
                      AND next_run_date = ?
                      AND last_run_date IS ?
                      AND is_active = ?
                `)
                .bind(
                    requestedActive,
                    userId,
                    now,
                    id,
                    companyId,
                    existing.updated_at,
                    existing.next_run_date,
                    existing.last_run_date,
                    existing.is_active,
                );

        const action =
            requestedActive === 1
                ? "ACTIVATED"
                : "DEACTIVATED";

        const auditStatement =
            prepareConditionalRecurringAudit(
                c.env.DB,
                {
                    companyId,
                    userId,

                    entityType:
                        "RECURRING_EXPENSE_RULE",

                    entityId:
                        id,

                    action,

                    metadata: {
                        previous_is_active:
                            existing.is_active,

                        is_active:
                            requestedActive,

                        next_run_date:
                            existing.next_run_date,

                        end_date:
                            existing.end_date,
                    },
                },
            );

        const results =
            await c.env.DB.batch([
                updateStatement,
                auditStatement,
            ]);

        if (
            !results[0]?.success ||
            !results[1]?.success
        ) {
            throw new Error(
                "Recurring expense rule status update did not complete",
            );
        }

        if (results[0].meta.changes === 0) {
            if (results[1].meta.changes !== 0) {
                throw new Error(
                    "A stale recurring-rule mutation generated an audit",
                );
            }

            return c.json(
                {
                    success: false,
                    message:
                        "Recurring expense rule changed. Reload and try again.",
                },
                409,
            );
        }

        if (
            results[0].meta.changes !== 1 ||
            results[1].meta.changes !== 1
        ) {
            throw new Error(
                "Recurring expense rule status update had unexpected write counts",
            );
        }

        return c.json({
            success: true,

            message:
                requestedActive === 1
                    ? "Recurring expense rule activated successfully"
                    : "Recurring expense rule deactivated successfully",

            recurring_expense: {
                id,

                is_active:
                    requestedActive,

                next_run_date:
                    existing.next_run_date,

                end_date:
                    existing.end_date,

                updated_by:
                    userId,

                updated_at:
                    now,
            },
        });
    }
}
