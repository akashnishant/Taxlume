import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const ProductStatusRequest = z.object({
    is_active: z.boolean(),
});

export class ProductStatus extends OpenAPIRoute {
    schema = {
        tags: ["Products"],
        summary: "Activate or deactivate a product or service",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
            body: {
                content: {
                    "application/json": {
                        schema: ProductStatusRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Product status updated successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                    },
                },
            },
            "404": {
                description: "Product not found",
            },
            "401": {
                description: "Authentication required",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");

        if (!companyId) {
            return c.json(
                {
                    success: false,
                    message: "Authentication context is missing",
                },
                401,
            );
        }

        const data =
            await this.getValidatedData<typeof this.schema>();

        const { id } = data.params;
        const { is_active } = data.body;

        const existing = await c.env.DB
            .prepare(`
				SELECT id
				FROM products
				WHERE id = ?
					AND company_id = ?
				LIMIT 1
			`)
            .bind(id, companyId)
            .first<{ id: string }>();

        if (!existing) {
            return c.json(
                {
                    success: false,
                    message: "Product not found",
                },
                404,
            );
        }

        await c.env.DB
            .prepare(`
				UPDATE products
				SET
					is_active = ?,
					updated_at = ?
				WHERE id = ?
					AND company_id = ?
			`)
            .bind(
                is_active ? 1 : 0,
                new Date().toISOString(),
                id,
                companyId,
            )
            .run();

        return c.json(
            {
                success: true,
                message: is_active
                    ? "Product activated successfully"
                    : "Product deactivated successfully",
            },
            200,
        );
    }
}