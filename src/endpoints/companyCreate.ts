import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { isValidGstStatePair } from "../utils/gstStates";

const CompanyCreateRequest = z
    .object({
        legal_name: z.string().min(1).max(200),
        trade_name: z.string().max(200).optional(),
        gstin: z.string().max(15).optional(),
        pan: z.string().max(10).optional(),
        email: z.email().optional(),
        phone: z.string().max(30).optional(),
        website: z.string().max(500).optional(),
        address_line1: z.string().max(300).optional(),
        address_line2: z.string().max(300).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        state_code: z.string().max(10).optional(),
        pincode: z.string().max(10).optional(),
        country: z.string().max(100).default("India"),
        currency_code: z.string().length(3).default("INR"),
    })
    .superRefine((company, ctx) => {
        if (company.country.trim().toLowerCase() !== "india") {
            return;
        }

        const state = company.state?.trim() ?? "";
        const stateCode = company.state_code?.trim() ?? "";

        if (!state && !stateCode) {
            return;
        }

        if (!state || !stateCode) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: !state ? ["state"] : ["state_code"],
                message:
                    "State and state code must both be provided.",
            });
            return;
        }

        if (!isValidGstStatePair(state, stateCode)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["state_code"],
                message:
                    "State and state code do not match.",
            });
        }
    });

export class CompanyCreate extends OpenAPIRoute {
    schema = {
        tags: ["Companies"],
        summary: "Create a company",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: CompanyCreateRequest,
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Company created successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            company: z.object({
                                id: z.string(),
                                legal_name: z.string(),
                                trade_name: z.string().nullable(),
                                gstin: z.string().nullable(),
                                pan: z.string().nullable(),
                                email: z.string().nullable(),
                                phone: z.string().nullable(),
                                country: z.string(),
                                currency_code: z.string(),
                            }),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const data =
            await this.getValidatedData<typeof this.schema>();

        const body = data.body;

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await c.env.DB
            .prepare(`
				INSERT INTO companies (
					id,
					legal_name,
					trade_name,
					gstin,
					pan,
					email,
					phone,
					website,
					address_line1,
					address_line2,
					city,
					state,
					state_code,
					pincode,
					country,
					currency_code,
					created_at,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`)
            .bind(
                id,
                body.legal_name,
                body.trade_name ?? null,
                body.gstin ?? null,
                body.pan ?? null,
                body.email ?? null,
                body.phone ?? null,
                body.website ?? null,
                body.address_line1 ?? null,
                body.address_line2 ?? null,
                body.city ?? null,
                body.state ?? null,
                body.state_code ?? null,
                body.pincode ?? null,
                body.country,
                body.currency_code.toUpperCase(),
                now,
                now,
            )
            .run();

        return c.json(
            {
                success: true,
                company: {
                    id,
                    legal_name: body.legal_name,
                    trade_name: body.trade_name ?? null,
                    gstin: body.gstin ?? null,
                    pan: body.pan ?? null,
                    email: body.email ?? null,
                    phone: body.phone ?? null,
                    country: body.country,
                    currency_code: body.currency_code.toUpperCase(),
                },
            },
            201,
        );
    }
}