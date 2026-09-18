import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class ProductGet extends OpenAPIRoute {
    schema = {
        tags: ["Products"],
        summary: "Get a product or service by ID",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
        },
        responses: {
            "200": {
                description: "Product retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            product: z.object({
                                id: z.string(),
                                item_type: z.string(),
                                name: z.string(),
                                description: z.string().nullable(),
                                sku: z.string().nullable(),
                                hsn_sac: z.string().nullable(),
                                unit: z.string(),
                                selling_price_paise: z.number(),
                                purchase_price_paise: z.number(),
                                gst_rate_bps: z.number(),
                                cess_rate_bps: z.number(),
                                opening_stock_milli: z.number(),
                                track_inventory: z.number(),
                                is_active: z.number(),
                                created_at: z.string(),
                                updated_at: z.string(),
                            }),
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

        const { params } =
            await this.getValidatedData<typeof this.schema>();

        const { id } = params;

        const product = await c.env.DB
            .prepare(`
				SELECT
					id,
					item_type,
					name,
					description,
					sku,
					hsn_sac,
					unit,
					selling_price_paise,
					purchase_price_paise,
					gst_rate_bps,
					cess_rate_bps,
					opening_stock_milli,
					track_inventory,
					is_active,
					created_at,
					updated_at
				FROM products
				WHERE id = ?
					AND company_id = ?
				LIMIT 1
			`)
            .bind(id, companyId)
            .first<{
                id: string;
                item_type: string;
                name: string;
                description: string | null;
                sku: string | null;
                hsn_sac: string | null;
                unit: string;
                selling_price_paise: number;
                purchase_price_paise: number;
                gst_rate_bps: number;
                cess_rate_bps: number;
                opening_stock_milli: number;
                track_inventory: number;
                is_active: number;
                created_at: string;
                updated_at: string;
            }>();

        if (!product) {
            return c.json(
                {
                    success: false,
                    message: "Product not found",
                },
                404,
            );
        }

        return c.json(
            {
                success: true,
                product,
            },
            200,
        );
    }
}