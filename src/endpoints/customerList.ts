import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class CustomerList extends OpenAPIRoute {
    schema = {
        tags: ["Customers"],
        summary: "List customers",
        responses: {
            "200": {
                description: "Customers retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            customers: z.array(
                                z.object({
                                    id: z.string(),
                                    display_name: z.string(),
                                    legal_name: z.string().nullable(),
                                    gstin: z.string().nullable(),
                                    pan: z.string().nullable(),
                                    email: z.string().nullable(),
                                    phone: z.string().nullable(),
                                    contact_person: z.string().nullable(),
                                    payment_terms_days: z.number(),
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
					p.id,
					p.display_name,
					p.legal_name,
					p.gstin,
					p.pan,
					p.email,
					p.phone,
					p.contact_person,
					p.payment_terms_days,
					p.is_active,
					p.created_at
				FROM parties p
				INNER JOIN party_roles pr
					ON pr.party_id = p.id
				WHERE p.company_id = ?
                    AND pr.role = 'CUSTOMER'
                ORDER BY p.is_active DESC, p.display_name ASC
			`)
            .bind(companyId)
            .all<{
                id: string;
                display_name: string;
                legal_name: string | null;
                gstin: string | null;
                pan: string | null;
                email: string | null;
                phone: string | null;
                contact_person: string | null;
                payment_terms_days: number;
                is_active: number;
                created_at: string;
            }>();

        return {
            success: true,
            customers: result.results,
        };
    }
}