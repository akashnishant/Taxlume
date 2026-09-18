import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { isValidGstStatePair } from "../utils/gstStates";

const VendorCreateRequest = z.object({
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
        }),

    opening_balance_paise: z.number().int().min(0).default(0),
    credit_limit_paise: z.number().int().min(0).default(0),
    payment_terms_days: z.number().int().min(0).default(0),
    notes: z.string().max(5000).optional(),
});

export class VendorCreate extends OpenAPIRoute {
    schema = {
        tags: ["Vendors"],
        summary: "Create a vendor",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: VendorCreateRequest,
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Vendor created successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            vendor: z.object({
                                id: z.string(),
                                display_name: z.string(),
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

        const vendorId = crypto.randomUUID();
        const roleId = crypto.randomUUID();

        const statements = [
            c.env.DB
                .prepare(`
					INSERT INTO parties (
						id,
						company_id,
						display_name,
						legal_name,
						gstin,
						pan,
						email,
						phone,
						alternate_phone,
						contact_person,
						opening_balance_paise,
						credit_limit_paise,
						payment_terms_days,
						notes,
						is_active,
						created_at,
						updated_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
				`)
                .bind(
                    vendorId,
                    companyId,
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
                    now,
                ),

            c.env.DB
                .prepare(`
					INSERT INTO party_roles (
						id,
						party_id,
						role,
						created_at
					)
					VALUES (?, ?, 'VENDOR', ?)
				`)
                .bind(
                    roleId,
                    vendorId,
                    now,
                ),
        ];

        if (body.address) {
            statements.push(
                c.env.DB
                    .prepare(`
						INSERT INTO party_addresses (
							id,
							party_id,
							address_type,
							label,
							address_line1,
							address_line2,
							city,
							state,
							state_code,
							pincode,
							country,
							is_default,
							created_at,
							updated_at
						)
						VALUES (?, ?, 'BILLING', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
					`)
                    .bind(
                        crypto.randomUUID(),
                        vendorId,
                        "Primary",
                        body.address.address_line1,
                        body.address.address_line2 ?? null,
                        body.address.city ?? null,
                        body.address.state ?? null,
                        body.address.state_code ?? null,
                        body.address.pincode ?? null,
                        body.address.country,
                        now,
                        now,
                    ),
            );
        }

        await c.env.DB.batch(statements);

        return c.json(
            {
                success: true,
                vendor: {
                    id: vendorId,
                    display_name: body.display_name,
                },
            },
            201,
        );
    }
}