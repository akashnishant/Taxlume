import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { hashPassword } from "../utils/password";
import { isValidGstStatePair } from "../utils/gstStates";
import {
    doesGstinMatchStateCode,
    isValidGstinFormat,
    normalizeGstin,
} from "../utils/gstin";

const RegisterRequest = z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
    full_name: z.string().min(1).max(200),

    company: z
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
            const gstin = company.gstin?.trim() ?? "";

            if (gstin && !isValidGstinFormat(gstin)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["gstin"],
                    message: "GSTIN format is invalid.",
                });
            }

            if (company.country.trim().toLowerCase() !== "india") {
                return;
            }

            const state = company.state?.trim() ?? "";
            const stateCode = company.state_code?.trim() ?? "";

            if (!state && !stateCode) {
                if (gstin) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["state"],
                        message:
                            "State and state code are required when GSTIN is provided.",
                    });
                }

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

                return;
            }

            if (
                gstin &&
                isValidGstinFormat(gstin) &&
                !doesGstinMatchStateCode(gstin, stateCode)
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["gstin"],
                    message:
                        "GSTIN state code does not match the company state code.",
                });
            }
        })
});

export class Register extends OpenAPIRoute {
    schema = {
        tags: ["Authentication"],
        summary: "Register a new Taxlume user and company",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: RegisterRequest,
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Registration successful",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            user_id: z.string(),
                            company_id: z.string(),
                            message: z.string(),
                        }),
                    },
                },
            },
            "409": {
                description: "Email already registered",
            },
        },
    };

    async handle(c: AppContext) {
        const data =
            await this.getValidatedData<typeof this.schema>();

        const body = data.body;

        const existingUser = await c.env.DB
            .prepare("SELECT id FROM users WHERE email = ?")
            .bind(body.email.toLowerCase())
            .first<{ id: string }>();

        if (existingUser) {
            return c.json(
                {
                    success: false,
                    message: "Email is already registered",
                },
                409,
            );
        }

        const userId = crypto.randomUUID();
        const companyId = crypto.randomUUID();
        const membershipId = crypto.randomUUID();
        const now = new Date().toISOString();

        const passwordHash = await hashPassword(body.password);

        await c.env.DB.batch([
            c.env.DB
                .prepare(`
					INSERT INTO users (
						id,
						email,
						password_hash,
						full_name,
						email_verified,
						is_active,
						created_at,
						updated_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`)
                .bind(
                    userId,
                    body.email.toLowerCase(),
                    passwordHash,
                    body.full_name,
                    0,
                    1,
                    now,
                    now,
                ),

            c.env.DB
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
                    companyId,
                    body.company.legal_name,
                    body.company.trade_name ?? null,
                    body.company.gstin
                        ? normalizeGstin(body.company.gstin)
                        : null,
                    body.company.pan ?? null,
                    body.company.email ?? null,
                    body.company.phone ?? null,
                    body.company.website ?? null,
                    body.company.address_line1 ?? null,
                    body.company.address_line2 ?? null,
                    body.company.city ?? null,
                    body.company.state ?? null,
                    body.company.state_code ?? null,
                    body.company.pincode ?? null,
                    body.company.country,
                    body.company.currency_code.toUpperCase(),
                    now,
                    now,
                ),

            c.env.DB
                .prepare(`
					INSERT INTO company_members (
						id,
						company_id,
						user_id,
						role,
						is_active,
						created_at,
						updated_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?)
				`)
                .bind(
                    membershipId,
                    companyId,
                    userId,
                    "OWNER",
                    1,
                    now,
                    now,
                ),
        ]);

        return c.json(
            {
                success: true,
                user_id: userId,
                company_id: companyId,
                message: "Registration successful",
            },
            201,
        );
    }
}