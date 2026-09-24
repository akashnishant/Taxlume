import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { ensureDefaultCategories } from "../utils/expenses/ensureDefaultCategories";

const ExpenseCategorySchema = z.object({
    id: z.string(),
    name: z.string(),
    parent_category_id: z.string().nullable(),
    description: z.string().nullable(),
    display_order: z.number(),
    is_active: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
});

type ExpenseCategoryRow = z.infer<typeof ExpenseCategorySchema>;

export class ExpenseCategoryList extends OpenAPIRoute {
    schema = {
        tags: ["Expense Categories"],
        summary: "List expense categories for the authenticated company",
        responses: {
            "200": {
                description: "Expense categories retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            categories: z.array(ExpenseCategorySchema),
                        }),
                    },
                },
            },
            "401": {
                description: "Authentication required",
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

        await ensureDefaultCategories(
            c.env.DB,
            companyId,
            userId,
        );

        const result = await c.env.DB
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
                WHERE company_id = ?
                ORDER BY
                    CASE
                        WHEN parent_category_id IS NULL THEN 0
                        ELSE 1
                    END,
                    display_order ASC,
                    name COLLATE NOCASE ASC
            `)
            .bind(companyId)
            .all<ExpenseCategoryRow>();

        return {
            success: true,
            categories: result.results,
        };
    }
}
