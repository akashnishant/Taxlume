import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { prepareAuditLog } from "../utils/audit/auditLog";
import { ensureDefaultCategories } from "../utils/expenses/ensureDefaultCategories";

const ExpenseCategoryCreateRequest = z.object({
    name: z.string().trim().min(1).max(100),

    parent_category_id: z.string().uuid().nullable().optional(),

    description: z.string().trim().max(500).nullable().optional(),

    display_order: z.number().int().min(0).max(10000).default(0),
});

type ParentCategoryRow = {
    id: string;
    parent_category_id: string | null;
    is_active: number;
};

export class ExpenseCategoryCreate extends OpenAPIRoute {
    schema = {
        tags: ["Expense Categories"],
        summary: "Create an expense category or subcategory",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ExpenseCategoryCreateRequest,
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Expense category created successfully",
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
                description: "Invalid category or parent category",
            },
            "401": {
                description: "Authentication required",
            },
            "409": {
                description: "Category name already exists under this parent",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");
        const userId = c.get("userId");

        if (!companyId || !userId) {
            return c.json(
                {
                    success: false,
                    message: "Authentication context is missing",
                },
                401,
            );
        }

        const validated =
            await this.getValidatedData<typeof this.schema>();

        const body = validated.body;
        const parentId = body.parent_category_id ?? null;

        // Keep the initialization behavior consistent even if POST
        // is the company's first request to the Categories API.
        await ensureDefaultCategories(c.env.DB, companyId, userId);

        if (parentId) {
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
                .first<ParentCategoryRow>();

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

            // A subcategory cannot itself become a parent.
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

        const categoryId = crypto.randomUUID();
        const now = new Date().toISOString();
        const description = body.description || null;

        const insertStatement = c.env.DB
            .prepare(`
                INSERT INTO expense_categories (
                    id,
                    company_id,
                    name,
                    parent_category_id,
                    description,
                    display_order,
                    is_active,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            `)
            .bind(
                categoryId,
                companyId,
                body.name,
                parentId,
                description,
                body.display_order,
                userId,
                now,
                now,
            );

        const auditStatement = prepareAuditLog(c.env.DB, {
            companyId,
            userId,
            entityType: "EXPENSE_CATEGORY",
            entityId: categoryId,
            action: "CREATED",
            metadata: {
                parent_category_id: parentId,
            },
        });

        try {
            // If either statement fails, D1 rolls back the batch.
            await c.env.DB.batch([
                insertStatement,
                auditStatement,
            ]);
        } catch (error) {
            const errorMessage = String(error);

            // These are the two unique indexes defined in
            // migrations/0015_expenses.sql.
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

            // Do not hide unexpected database failures as duplicates.
            throw error;
        }

        return c.json(
            {
                success: true,
                category: {
                    id: categoryId,
                    name: body.name,
                    parent_category_id: parentId,
                    description,
                    display_order: body.display_order,
                    is_active: 1,
                    created_at: now,
                    updated_at: now,
                },
            },
            201,
        );
    }
}
