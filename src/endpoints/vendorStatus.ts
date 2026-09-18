import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const VendorIdParams = z.object({
    id: z.string().uuid(),
});

const VendorStatusRequest = z.object({
    is_active: z.boolean(),
});

export class VendorStatus extends OpenAPIRoute {
    schema = {
        tags: ["Vendors"],
        summary: "Activate or deactivate a vendor",
        request: {
            params: VendorIdParams,
            body: {
                content: {
                    "application/json": {
                        schema: VendorStatusRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Vendor status updated successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                    },
                },
            },
            "400": {
                description: "Invalid vendor ID",
            },
            "404": {
                description: "Vendor not found",
            },
            "401": {
                description: "Authentication required",
            },
        },
    };

    async handle(c: AppContext) {
        const id = c.req.param("id");
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

        if (!id || !z.uuid().safeParse(id).success) {
            return c.json(
                {
                    success: false,
                    message: "Invalid vendor ID",
                },
                400,
            );
        }

        const data =
            await this.getValidatedData<typeof this.schema>();

        const body = data.body;
        const now = new Date().toISOString();

        const vendor = await c.env.DB
            .prepare(`
				SELECT p.id
				FROM parties p
				INNER JOIN party_roles pr
					ON pr.party_id = p.id
				WHERE p.id = ?
					AND p.company_id = ?
					AND pr.role = 'VENDOR'
				LIMIT 1
			`)
            .bind(id, companyId)
            .first<{ id: string }>();

        if (!vendor) {
            return c.json(
                {
                    success: false,
                    message: "Vendor not found",
                },
                404,
            );
        }

        await c.env.DB
            .prepare(`
				UPDATE parties
				SET
					is_active = ?,
					updated_at = ?
				WHERE id = ?
					AND company_id = ?
			`)
            .bind(
                body.is_active ? 1 : 0,
                now,
                id,
                companyId,
            )
            .run();

        return {
            success: true,
            message: body.is_active
                ? "Vendor activated successfully"
                : "Vendor deactivated successfully",
        };
    }
}