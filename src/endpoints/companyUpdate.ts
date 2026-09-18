import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { isValidGstStatePair } from "../utils/gstStates";

const CompanyUpdateRequest = z
    .object({
        legal_name: z.string().min(1).max(200),
        trade_name: z.string().max(200).optional(),
        gstin: z.string().max(15).optional(),
        pan: z.string().max(10).optional(),
        email: z.string().email().max(254).optional(),
        phone: z.string().max(30).optional(),
        website: z.string().url().max(500).optional(),
        address_line1: z.string().max(255).optional(),
        address_line2: z.string().max(255).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        state_code: z.string().max(10).optional(),
        pincode: z.string().max(20).optional(),
        country: z.string().min(2).max(100).default("India"),
        currency_code: z.string().length(3).default("INR"),
        financial_year_start_month: z
            .number()
            .int()
            .min(1)
            .max(12)
            .default(4),
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

type CompanyRow = {
    id: string;
    legal_name: string;
    trade_name: string | null;
    gstin: string | null;
    pan: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    state_code: string | null;
    pincode: string | null;
    country: string;
    logo_key: string | null;
    signature_key: string | null;
    currency_code: string;
    financial_year_start_month: number;
};

export class CompanyUpdate extends OpenAPIRoute {
    schema = {
        tags: ["Company"],
        summary: "Update company settings",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: CompanyUpdateRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Company settings updated successfully",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Company not found",
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

        const existingCompany =
            await c.env.DB
                .prepare(`
					SELECT id
					FROM companies
					WHERE id = ?
						AND is_active = 1
					LIMIT 1
				`)
                .bind(companyId)
                .first<{ id: string }>();

        if (!existingCompany) {
            return c.json(
                {
                    success: false,
                    message: "Company not found",
                },
                404,
            );
        }

        const now =
            new Date().toISOString();

        await c.env.DB
            .prepare(`
				UPDATE companies
				SET
					legal_name = ?,
					trade_name = ?,
					gstin = ?,
					pan = ?,
					email = ?,
					phone = ?,
					website = ?,
					address_line1 = ?,
					address_line2 = ?,
					city = ?,
					state = ?,
					state_code = ?,
					pincode = ?,
					country = ?,
					currency_code = ?,
					financial_year_start_month = ?,
					updated_at = ?
				WHERE id = ?
					AND is_active = 1
			`)
            .bind(
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
                body.financial_year_start_month,
                now,
                companyId,
            )
            .run();

        const company =
            await c.env.DB
                .prepare(`
					SELECT
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
                        logo_key,
                        signature_key,
                        currency_code,
                        financial_year_start_month
					FROM companies
					WHERE id = ?
					LIMIT 1
				`)
                .bind(companyId)
                .first<CompanyRow>();

        return c.json({
            success: true,
            company,
        });
    }
}