import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const VendorIdParams = z.object({
    id: z.string().uuid(),
});

export class VendorGet extends OpenAPIRoute {
    schema = {
        tags: ["Vendors"],
        summary: "Get a vendor by ID",
        request: {
            params: VendorIdParams,
        },
        responses: {
            "200": {
                description: "Vendor retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            vendor: z.object({
                                id: z.string(),
                                display_name: z.string(),
                                legal_name: z.string().nullable(),
                                gstin: z.string().nullable(),
                                pan: z.string().nullable(),
                                email: z.string().nullable(),
                                phone: z.string().nullable(),
                                alternate_phone: z.string().nullable(),
                                contact_person: z.string().nullable(),
                                opening_balance_paise: z.number(),
                                credit_limit_paise: z.number(),
                                payment_terms_days: z.number(),
                                notes: z.string().nullable(),
                                is_active: z.number(),
                                created_at: z.string(),
                                updated_at: z.string(),
                                addresses: z.array(
                                    z.object({
                                        id: z.string(),
                                        address_type: z.string(),
                                        label: z.string().nullable(),
                                        address_line1: z.string(),
                                        address_line2: z.string().nullable(),
                                        city: z.string().nullable(),
                                        state: z.string().nullable(),
                                        state_code: z.string().nullable(),
                                        pincode: z.string().nullable(),
                                        country: z.string(),
                                        is_default: z.number(),
                                    }),
                                ),
                            }),
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

        const vendor = await c.env.DB
            .prepare(`
				SELECT
					p.id,
					p.display_name,
					p.legal_name,
					p.gstin,
					p.pan,
					p.email,
					p.phone,
					p.alternate_phone,
					p.contact_person,
					p.opening_balance_paise,
					p.credit_limit_paise,
					p.payment_terms_days,
					p.notes,
					p.is_active,
					p.created_at,
					p.updated_at
				FROM parties p
				INNER JOIN party_roles pr
					ON pr.party_id = p.id
				WHERE p.id = ?
					AND p.company_id = ?
					AND pr.role = 'VENDOR'
				LIMIT 1
			`)
            .bind(id, companyId)
            .first<{
                id: string;
                display_name: string;
                legal_name: string | null;
                gstin: string | null;
                pan: string | null;
                email: string | null;
                phone: string | null;
                alternate_phone: string | null;
                contact_person: string | null;
                opening_balance_paise: number;
                credit_limit_paise: number;
                payment_terms_days: number;
                notes: string | null;
                is_active: number;
                created_at: string;
                updated_at: string;
            }>();

        if (!vendor) {
            return c.json(
                {
                    success: false,
                    message: "Vendor not found",
                },
                404,
            );
        }

        const addresses = await c.env.DB
            .prepare(`
				SELECT
					id,
					address_type,
					label,
					address_line1,
					address_line2,
					city,
					state,
					state_code,
					pincode,
					country,
					is_default
				FROM party_addresses
				WHERE party_id = ?
				ORDER BY is_default DESC, created_at ASC
			`)
            .bind(vendor.id)
            .all<{
                id: string;
                address_type: string;
                label: string | null;
                address_line1: string;
                address_line2: string | null;
                city: string | null;
                state: string | null;
                state_code: string | null;
                pincode: string | null;
                country: string;
                is_default: number;
            }>();

        return {
            success: true,
            vendor: {
                ...vendor,
                addresses: addresses.results,
            },
        };
    }
}