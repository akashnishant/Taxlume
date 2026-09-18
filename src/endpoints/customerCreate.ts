import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { isValidGstStatePair } from "../utils/gstStates";
import {
    doesGstinMatchStateCode,
    isValidGstinFormat,
    normalizeGstin,
} from "../utils/gstin";

const CustomerCreateRequest = z.object({
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
})
.superRefine((customer, ctx) => {
        const gstin = customer.gstin?.trim();

        if (!gstin) {
            return;
        }

        if (!isValidGstinFormat(gstin)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["gstin"],
                message: "GSTIN format is invalid.",
            });
            return;
        }

        if (
            customer.address.country
                .trim()
                .toLowerCase() === "india" &&
            !doesGstinMatchStateCode(
                gstin,
                customer.address.state_code,
            )
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["gstin"],
                message:
                    "GSTIN state code does not match the address state code.",
            });
        }
    });

export class CustomerCreate extends OpenAPIRoute {
    schema = {
        tags: ["Customers"],
        summary: "Create a customer",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: CustomerCreateRequest,
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Customer created successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            customer: z.object({
                                id: z.string(),
                                display_name: z.string(),
                                role: z.string(),
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
        const data =
            await this.getValidatedData<typeof this.schema>();

        const body = data.body;
        const companyId = c.get("companyId");

        const customerId = crypto.randomUUID();
        const roleId = crypto.randomUUID();
        const now = new Date().toISOString();

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
						created_at,
						updated_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`)
                .bind(
                    customerId,
                    companyId,
                    body.display_name,
                    body.legal_name ?? null,
                    body.gstin
                        ? normalizeGstin(body.gstin)
                        : null,
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
					VALUES (?, ?, ?, ?)
				`)
                .bind(
                    roleId,
                    customerId,
                    "CUSTOMER",
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
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`)
                    .bind(
                        crypto.randomUUID(),
                        customerId,
                        "BILLING",
                        "Primary",
                        body.address.address_line1,
                        body.address.address_line2 ?? null,
                        body.address.city ?? null,
                        body.address.state ?? null,
                        body.address.state_code ?? null,
                        body.address.pincode ?? null,
                        body.address.country,
                        1,
                        now,
                        now,
                    ),
            );
        }

        await c.env.DB.batch(statements);

        return c.json(
            {
                success: true,
                customer: {
                    id: customerId,
                    display_name: body.display_name,
                    role: "CUSTOMER",
                },
            },
            201,
        );
    }
}