import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { prepareConditionalRecurringAudit } from "../utils/expenses/prepareConditionalRecurringAudit";

type ExistingRule = {
    id: string;
    name: string;
    is_active: number;
    start_date: string;
    end_date: string | null;
    next_run_date: string;
    last_run_date: string | null;
    updated_at: string;
};

export class RecurringExpenseDelete
    extends OpenAPIRoute {

    schema = {
        tags: ["Recurring Expenses"],

        summary:
            "Delete recurring expense rule",

        request: {
            params: z.object({
                id:
                    z.string().uuid(),
            }),
        },

        responses: {
            "200": {
                description:
                    "Recurring expense rule deleted successfully",
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

        const existing =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        name,
                        is_active,
                        start_date,
                        end_date,
                        next_run_date,
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
                .first<ExistingRule>();

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

        const now =
            new Date().toISOString();

        /*
         * Generated expenses remain historical records.
         * Deleting a recurring rule only prevents any
         * future generation from the rule.
         */
        const updateStatement =
            c.env.DB
                .prepare(`
                    UPDATE recurring_expense_rules

                    SET
                        is_active = 0,
                        updated_by = ?,
                        deleted_by = ?,
                        updated_at = ?,
                        deleted_at = ?

                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL
                      AND updated_at = ?
                      AND next_run_date = ?
                      AND last_run_date IS ?
                      AND is_active = ?
                `)
                .bind(
                    userId,
                    userId,
                    now,
                    now,
                    id,
                    companyId,
                    existing.updated_at,
                    existing.next_run_date,
                    existing.last_run_date,
                    existing.is_active,
                );

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

                    action:
                        "DELETED",

                    metadata: {
                        name:
                            existing.name,

                        previous_is_active:
                            existing.is_active,

                        start_date:
                            existing.start_date,

                        end_date:
                            existing.end_date,

                        next_run_date:
                            existing.next_run_date,

                        last_run_date:
                            existing.last_run_date,
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
                "Recurring expense rule deletion did not complete",
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
                "Recurring expense rule deletion had unexpected write counts",
            );
        }

        return c.json({
            success: true,

            message:
                "Recurring expense rule deleted successfully",
        });
    }
}
