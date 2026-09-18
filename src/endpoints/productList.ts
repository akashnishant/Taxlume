import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class ProductList extends OpenAPIRoute {
    schema = {
        tags: ["Products"],
        summary: "List products and services",
        responses: {
            "200": {
                description: "Products retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            products: z.array(
                                z.object({
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
                                }),
                            ),
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

        const result = await c.env.DB
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
					created_at
				FROM products
				WHERE company_id = ?
                ORDER BY name ASC
			`)
            .bind(companyId)
            .all<{
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
            }>();

        return {
            success: true,
            products: result.results,
        };
    }
}