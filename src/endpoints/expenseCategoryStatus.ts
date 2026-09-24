import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

const CategoryStatusRequest = z.object({
    is_active: z.boolean(),
});

type CategoryRow = {
    id: string;
    parent_category_id: string | null;
    is_active: number;
};

export class ExpenseCategoryStatus extends OpenAPIRoute {
    schema = {
        tags: ["Expense Categories"],
        summary: "Activate or deactivate an expense category",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
            body: {
                content: {
                    "application/json": {
                        schema: CategoryStatusRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Category status updated successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                            category: z.object({
                                id: z.string(),
                                is_active: z.number(),
                            }),
                        }),
                    },
                },
            },
            "400": {
                description: "Invalid category or inactive parent",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Category not found",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");
        const userId = c.get("userId");
        const id = c.req.param("id");

        if (!companyId || !userId) {
            return c.json(
                {
                    success: false,
                    message: "Authentication context is missing",
                },
                401,
            );
        }

        if (!id || !z.uuid().safeParse(id).success) {
            return c.json(
                {
                    success: false,
                    message: "Invalid category ID",
                },
                400,
            );
        }

        const validated =
            await this.getValidatedData<typeof this.schema>();

        const requestedStatus = validated.body.is_active ? 1 : 0;

        const category = await c.env.DB
            .prepare(`
                SELECT
                    id,
                    parent_category_id,
                    is_active
                FROM expense_categories
                WHERE id = ?
                  AND company_id = ?
                LIMIT 1
            `)
            .bind(id, companyId)
            .first<CategoryRow>();

        if (!category) {
            return c.json(
                {
                    success: false,
                    message: "Category not found",
                },
                404,
            );
        }

        // An inactive parent must be reactivated before its
        // subcategory can be explicitly activated.
        if (requestedStatus === 1 && category.parent_category_id) {
            const parent = await c.env.DB
                .prepare(`
                    SELECT is_active
                    FROM expense_categories
                    WHERE id = ?
                      AND company_id = ?
                      AND parent_category_id IS NULL
                    LIMIT 1
                `)
                .bind(category.parent_category_id, companyId)
                .first<{ is_active: number }>();

            if (!parent || parent.is_active !== 1) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Activate the parent category first",
                    },
                    400,
                );
            }
        }

        // Do not create another audit entry for a no-op request.
        if (category.is_active === requestedStatus) {
            return {
                success: true,
                message: requestedStatus
                    ? "Category is already active"
                    : "Category is already inactive",
                category: {
                    id,
                    is_active: requestedStatus,
                },
            };
        }

        const now = new Date().toISOString();

        const updateStatement = c.env.DB
            .prepare(`
                UPDATE expense_categories
                SET
                    is_active = ?,
                    updated_by = ?,
                    updated_at = ?
                WHERE id = ?
                  AND company_id = ?
                  AND is_active = ?
            `)
            .bind(
                requestedStatus,
                userId,
                now,
                id,
                companyId,
                category.is_active,
            );

        const auditStatement = prepareAuditLog(c.env.DB, {
            companyId,
            userId,
            entityType: "EXPENSE_CATEGORY",
            entityId: id,
            action: requestedStatus === 1
                ? "ACTIVATED"
                : "DEACTIVATED",
            metadata: {
                previous_is_active: category.is_active,
                new_is_active: requestedStatus,
            },
        });

        const results = await c.env.DB.batch([
            updateStatement,
            auditStatement,
        ]);

        if (
            !results[0]?.success ||
            results[0].meta.changes !== 1 ||
            !results[1]?.success
        ) {
            throw new Error(
                "Expense category status update did not complete",
            );
        }

        return {
            success: true,
            message: requestedStatus
                ? "Category activated successfully"
                : "Category deactivated successfully",
            category: {
                id,
                is_active: requestedStatus,
            },
        };
    }
}
