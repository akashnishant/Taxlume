import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { isValidGstStatePair } from "../utils/gstStates";

const CustomerIdParams = z.object({
    id: z.string().uuid(),
});

const CustomerUpdateRequest = z.object({
    display_name: z.string().min(1).max(200),
    legal_name: z.string().max(200).optional(),
    gstin: z.string().max(15).optional(),
    pan: z.string().max(10).optional(),
    email: z.email().optional(),
    phone: z.string().max(30).optional(),
    alternate_phone: z.string().max(30).optional(),
    contact_person: z.string().max(200).optional(),

    address: z
        .object({
            address_line1: z.string().trim().min(1).max(300),
            address_line2: z.string().max(300).optional(),
            city: z.string().trim().min(1).max(100),
            state: z.string().trim().min(1).max(100),
            state_code: z.string().trim().min(1).max(10),
            pincode: z.string().trim().min(1).max(10),
            country: z.string().max(100).default("India"),
        })
        .superRefine((address, ctx) => {
            if (
                address.country.trim().toLowerCase() === "india" &&
                !isValidGstStatePair(
                    address.state,
                    address.state_code,
                )
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["state_code"],
                    message:
                        "State and state code do not match.",
                });
            }
        })
        .optional(),

    opening_balance_paise: z.number().int().min(0).default(0),
    credit_limit_paise: z.number().int().min(0).default(0),
    payment_terms_days: z.number().int().min(0).default(0),
    notes: z.string().max(5000).optional(),
});

export class CustomerUpdate extends OpenAPIRoute {
    schema = {
        tags: ["Customers"],
        summary: "Update a customer",
        request: {
            params: CustomerIdParams,
            body: {
                content: {
                    "application/json": {
                        schema: CustomerUpdateRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Customer updated successfully",
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
                description: "Invalid customer ID",
            },
            "404": {
                description: "Customer not found",
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
                    message: "Invalid customer ID",
                },
                400,
            );
        }

        const data =
            await this.getValidatedData<typeof this.schema>();

        const body = data.body;
        const now = new Date().toISOString();

        const customer = await c.env.DB
            .prepare(`
				SELECT p.id
				FROM parties p
				INNER JOIN party_roles pr
					ON pr.party_id = p.id
				WHERE p.id = ?
					AND p.company_id = ?
					AND pr.role = 'CUSTOMER'
				LIMIT 1
			`)
            .bind(id, companyId)
            .first<{ id: string }>();

        if (!customer) {
            return c.json(
                {
                    success: false,
                    message: "Customer not found",
                },
                404,
            );
        }

        await c.env.DB.batch([
            c.env.DB
                .prepare(`
					UPDATE parties
					SET
						display_name = ?,
						legal_name = ?,
						gstin = ?,
						pan = ?,
						email = ?,
						phone = ?,
						alternate_phone = ?,
						contact_person = ?,
						opening_balance_paise = ?,
						credit_limit_paise = ?,
						payment_terms_days = ?,
						notes = ?,
						updated_at = ?
					WHERE id = ?
						AND company_id = ?
				`)
                .bind(
                    body.display_name,
                    body.legal_name ?? null,
                    body.gstin ?? null,
                    body.pan ?? null,
                    body.email ?? null,
                    body.phone ?? null,
                    body.alternate_phone ?? null,
                    body.contact_person ?? null,
                    body.opening_balance_paise,
                    body.credit_limit_paise,
                    body.payment_terms_days,
                    body.notes ?? null,
                    now,
                    id,
                    companyId,
                ),

            ...(body.address
                ? [
                    c.env.DB
                        .prepare(`
								UPDATE party_addresses
								SET
									address_line1 = ?,
									address_line2 = ?,
									city = ?,
									state = ?,
									state_code = ?,
									pincode = ?,
									country = ?,
									updated_at = ?
								WHERE party_id = ?
									AND is_default = 1
							`)
                        .bind(
                            body.address.address_line1,
                            body.address.address_line2 ?? null,
                            body.address.city ?? null,
                            body.address.state ?? null,
                            body.address.state_code ?? null,
                            body.address.pincode ?? null,
                            body.address.country,
                            now,
                            id,
                        ),
                ]
                : []),
        ]);

        return {
            success: true,
            message: "Customer updated successfully",
        };
    }
}