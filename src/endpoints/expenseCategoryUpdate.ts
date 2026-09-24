import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";

const ExpenseCategoryUpdateRequest = z.object({
    name: z.string().trim().min(1).max(100),

    parent_category_id: z.string().uuid().nullable().optional(),

    description: z.string().trim().max(500).nullable().optional(),

    display_order: z.number().int().min(0).max(10000).optional(),
});

type CategoryRow = {
    id: string;
    name: string;
    parent_category_id: string | null;
    description: string | null;
    display_order: number;
    is_active: number;
    created_at: string;
    updated_at: string;
};

type ParentRow = {
    id: string;
    parent_category_id: string | null;
    is_active: number;
};

export class ExpenseCategoryUpdate extends OpenAPIRoute {
    schema = {
        tags: ["Expense Categories"],
        summary: "Update an expense category",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
            body: {
                content: {
                    "application/json": {
                        schema: ExpenseCategoryUpdateRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Expense category updated successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            category: z.object({
                                id: z.string(),
                                name: z.string(),
                                parent_category_id: z.string().nullable(),
                                description: z.string().nullable(),
                                display_order: z.number(),
                                is_active: z.number(),
                                created_at: z.string(),
                                updated_at: z.string(),
                            }),
                        }),
                    },
                },
            },
            "400": {
                description: "Invalid category or hierarchy",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Category not found",
            },
            "409": {
                description: "Category name already exists under this parent",
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

        const body = validated.body;

        const existing = await c.env.DB
            .prepare(`
                SELECT
                    id,
                    name,
                    parent_category_id,
                    description,
                    display_order,
                    is_active,
                    created_at,
                    updated_at
                FROM expense_categories
                WHERE id = ?
                  AND company_id = ?
                LIMIT 1
            `)
            .bind(id, companyId)
            .first<CategoryRow>();

        if (!existing) {
            return c.json(
                {
                    success: false,
                    message: "Category not found",
                },
                404,
            );
        }

        const parentId =
            body.parent_category_id === undefined
                ? existing.parent_category_id
                : body.parent_category_id;

        const description =
            body.description === undefined
                ? existing.description
                : body.description || null;

        const displayOrder =
            body.display_order ?? existing.display_order;

        if (parentId === id) {
            return c.json(
                {
                    success: false,
                    message: "A category cannot be its own parent",
                },
                400,
            );
        }

        if (parentId !== existing.parent_category_id) {
            // A category with children cannot become a subcategory:
            // doing so would create a third hierarchy level.
            if (parentId !== null) {
                const existingChild = await c.env.DB
                    .prepare(`
                        SELECT id
                        FROM expense_categories
                        WHERE company_id = ?
                          AND parent_category_id = ?
                        LIMIT 1
                    `)
                    .bind(companyId, id)
                    .first<{ id: string }>();

                if (existingChild) {
                    return c.json(
                        {
                            success: false,
                            message:
                                "A category with subcategories cannot be moved under another category",
                        },
                        400,
                    );
                }
            }

            if (parentId !== null) {
                const parent = await c.env.DB
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
                    .bind(parentId, companyId)
                    .first<ParentRow>();

                if (!parent || parent.is_active !== 1) {
                    return c.json(
                        {
                            success: false,
                            message:
                                "Parent category was not found or is inactive",
                        },
                        400,
                    );
                }

                if (parent.parent_category_id !== null) {
                    return c.json(
                        {
                            success: false,
                            message:
                                "Only top-level categories can have subcategories",
                        },
                        400,
                    );
                }
            }
        }

        const now = new Date().toISOString();

        const updateStatement = c.env.DB
            .prepare(`
                UPDATE expense_categories
                SET
                    name = ?,
                    parent_category_id = ?,
                    description = ?,
                    display_order = ?,
                    updated_by = ?,
                    updated_at = ?
                WHERE id = ?
                  AND company_id = ?
            `)
            .bind(
                body.name,
                parentId,
                description,
                displayOrder,
                userId,
                now,
                id,
                companyId,
            );

        const auditStatement = prepareAuditLog(c.env.DB, {
            companyId,
            userId,
            entityType: "EXPENSE_CATEGORY",
            entityId: id,
            action: "UPDATED",
            metadata: {
                previous_parent_category_id:
                    existing.parent_category_id,
                new_parent_category_id: parentId,
            },
        });

        try {
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
                    "Expense category update did not complete",
                );
            }
        } catch (error) {
            const errorMessage = String(error);

            if (
                /ux_expense_categories_top_level_name/i.test(errorMessage) ||
                /ux_expense_categories_child_name/i.test(errorMessage)
            ) {
                return c.json(
                    {
                        success: false,
                        message:
                            "A category with this name already exists at this level",
                    },
                    409,
                );
            }

            throw error;
        }

        return {
            success: true,
            category: {
                id,
                name: body.name,
                parent_category_id: parentId,
                description,
                display_order: displayOrder,
                is_active: existing.is_active,
                created_at: existing.created_at,
                updated_at: now,
            },
        };
    }
}
