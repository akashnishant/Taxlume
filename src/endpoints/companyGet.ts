import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

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

export class CompanyGet extends OpenAPIRoute {
    schema = {
        tags: ["Company"],
        summary: "Get company settings",
        responses: {
            "200": {
                description: "Company settings retrieved successfully",
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

        const company = await c.env.DB
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
					AND is_active = 1
				LIMIT 1
			`)
            .bind(companyId)
            .first<CompanyRow>();

        if (!company) {
            return c.json(
                {
                    success: false,
                    message: "Company not found",
                },
                404,
            );
        }

        return c.json({
            success: true,
            company,
        });
    }
}