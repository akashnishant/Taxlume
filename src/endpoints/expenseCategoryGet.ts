import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

type ExpenseCategoryRow = {
    id: string;
    name: string;
    parent_category_id: string | null;
    description: string | null;
    display_order: number;
    is_active: number;
    created_at: string;
    updated_at: string;
};

export class ExpenseCategoryGet extends OpenAPIRoute {
    schema = {
        tags: ["Expense Categories"],
        summary: "Get an expense category for the authenticated company",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
        },
        responses: {
            "200": {
                description: "Expense category retrieved successfully",
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
                description: "Invalid category ID",
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
        const id = c.req.param("id");

        if (!companyId) {
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

        const category = await c.env.DB
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
            .first<ExpenseCategoryRow>();

        if (!category) {
            return c.json(
                {
                    success: false,
                    message: "Category not found",
                },
                404,
            );
        }

        return {
            success: true,
            category,
        };
    }
}
