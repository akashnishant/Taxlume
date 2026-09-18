import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const ProductUpdateRequest = z.object({
    item_type: z.enum(["PRODUCT", "SERVICE"]),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).nullable().optional(),
    sku: z.string().max(100).nullable().optional(),
    hsn_sac: z.string().max(20).nullable().optional(),
    unit: z.string().min(1).max(20),
    selling_price_paise: z.number().int().min(0),
    purchase_price_paise: z.number().int().min(0),
    gst_rate_bps: z.number().int().min(0),
    cess_rate_bps: z.number().int().min(0),
    opening_stock_milli: z.number().int().min(0),
    track_inventory: z.boolean(),
});

export class ProductUpdate extends OpenAPIRoute {
    schema = {
        tags: ["Products"],
        summary: "Update a product or service",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
            body: {
                content: {
                    "application/json": {
                        schema: ProductUpdateRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Product updated successfully",
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
        const body = data.body;
        const now = new Date().toISOString();

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
					item_type = ?,
					name = ?,
					description = ?,
					sku = ?,
					hsn_sac = ?,
					unit = ?,
					selling_price_paise = ?,
					purchase_price_paise = ?,
					gst_rate_bps = ?,
					cess_rate_bps = ?,
					opening_stock_milli = ?,
					track_inventory = ?,
					updated_at = ?
				WHERE id = ?
					AND company_id = ?
			`)
            .bind(
                body.item_type,
                body.name,
                body.description ?? null,
                body.sku ?? null,
                body.hsn_sac ?? null,
                body.unit,
                body.selling_price_paise,
                body.purchase_price_paise,
                body.gst_rate_bps,
                body.cess_rate_bps,
                body.opening_stock_milli,
                body.track_inventory ? 1 : 0,
                now,
                id,
                companyId,
            )
            .run();

        return c.json(
            {
                success: true,
                message: "Product updated successfully",
            },
            200,
        );
    }
}