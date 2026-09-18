import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const ProductCreateRequest = z.object({
    item_type: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    sku: z.string().max(100).optional(),
    hsn_sac: z.string().max(20).optional(),
    unit: z.string().min(1).max(20).default("NOS"),
    selling_price_paise: z.number().int().min(0).default(0),
    purchase_price_paise: z.number().int().min(0).default(0),
    gst_rate_bps: z.number().int().min(0).default(0),
    cess_rate_bps: z.number().int().min(0).default(0),
    opening_stock_milli: z.number().int().min(0).default(0),
    track_inventory: z.boolean().default(true),
});

export class ProductCreate extends OpenAPIRoute {
    schema = {
        tags: ["Products"],
        summary: "Create a product or service",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ProductCreateRequest,
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Product created successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            product: z.object({
                                id: z.string(),
                                name: z.string(),
                                item_type: z.string(),
                            }),
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

        const body = data.body;
        const now = new Date().toISOString();
        const productId = crypto.randomUUID();

        await c.env.DB
            .prepare(`
				INSERT INTO products (
					id,
					company_id,
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
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
			`)
            .bind(
                productId,
                companyId,
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
                now,
            )
            .run();

        return c.json(
            {
                success: true,
                product: {
                    id: productId,
                    name: body.name,
                    item_type: body.item_type,
                },
            },
            201,
        );
    }
}