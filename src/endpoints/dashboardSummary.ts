import { OpenAPIRoute } from "chanfana";
import { type AppContext } from "../types";

type DashboardMetricsRow = {
    currency_code: string;
    total_sales_paise: number;
    total_purchases_paise: number;
    outstanding_sales_paise: number;
    this_month_sales_paise: number;
    this_month_purchases_paise: number;
    customer_count: number;
};

type RecentDocumentRow = {
    id: string;
    document_number: string;
    document_date: string;
    party_name: string | null;
    status: string;
    currency_code: string;
    total_paise: number;
    amount_paid_paise: number;
};

function getMonthBounds(): {
    monthStart: string;
    nextMonthStart: string;
} {
    const now = new Date();

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    const monthStart = new Date(
        Date.UTC(year, month, 1),
    )
        .toISOString()
        .slice(0, 10);

    const nextMonthStart = new Date(
        Date.UTC(year, month + 1, 1),
    )
        .toISOString()
        .slice(0, 10);

    return {
        monthStart,
        nextMonthStart,
    };
}

export class DashboardSummary extends OpenAPIRoute {
    schema = {
        tags: ["Dashboard"],
        summary: "Get dashboard business summary",

        responses: {
            "200": {
                description:
                    "Dashboard summary retrieved successfully",
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
                    message:
                        "Authentication context is missing",
                },
                401,
            );
        }

        const {
            monthStart,
            nextMonthStart,
        } = getMonthBounds();

        const metrics = await c.env.DB
            .prepare(`
                SELECT
                    c.currency_code,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                    d.document_type = 'TAX_INVOICE'
                                    AND d.status = 'ISSUED'
                                THEN d.total_paise
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_sales_paise,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                    d.document_type = 'PURCHASE_ORDER'
                                    AND d.status = 'ISSUED'
                                THEN d.total_paise
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_purchases_paise,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                    d.document_type = 'TAX_INVOICE'
                                    AND d.status = 'ISSUED'
                                    AND d.total_paise >
                                        d.amount_paid_paise
                                THEN
                                    d.total_paise -
                                    d.amount_paid_paise
                                ELSE 0
                            END
                        ),
                        0
                    ) AS outstanding_sales_paise,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                    d.document_type = 'TAX_INVOICE'
                                    AND d.status = 'ISSUED'
                                    AND d.document_date >= ?
                                    AND d.document_date < ?
                                THEN d.total_paise
                                ELSE 0
                            END
                        ),
                        0
                    ) AS this_month_sales_paise,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN
                                    d.document_type = 'PURCHASE_ORDER'
                                    AND d.status = 'ISSUED'
                                    AND d.document_date >= ?
                                    AND d.document_date < ?
                                THEN d.total_paise
                                ELSE 0
                            END
                        ),
                        0
                    ) AS this_month_purchases_paise,

                    (
                        SELECT COUNT(DISTINCT p.id)
                        FROM parties p
                        INNER JOIN party_roles pr
                            ON pr.party_id = p.id
                        WHERE
                            p.company_id = c.id
                            AND p.is_active = 1
                            AND pr.role = 'CUSTOMER'
                    ) AS customer_count

                FROM companies c

                LEFT JOIN documents d
                    ON d.company_id = c.id
                    AND d.currency_code =
                        c.currency_code

                WHERE c.id = ?

                GROUP BY
                    c.id,
                    c.currency_code
            `)
            .bind(
                monthStart,
                nextMonthStart,
                monthStart,
                nextMonthStart,
                companyId,
            )
            .first<DashboardMetricsRow>();

        if (!metrics) {
            return c.json(
                {
                    success: false,
                    message: "Company was not found",
                },
                404,
            );
        }

        const recentSales = await c.env.DB
            .prepare(`
                SELECT
                    d.id,
                    d.document_number,
                    d.document_date,
                    p.display_name AS party_name,
                    d.status,
                    d.currency_code,
                    d.total_paise,
                    d.amount_paid_paise

                FROM documents d

                LEFT JOIN parties p
                    ON p.id = d.party_id
                    AND p.company_id =
                        d.company_id

                WHERE
                    d.company_id = ?
                    AND d.document_type =
                        'TAX_INVOICE'

                ORDER BY
                    d.document_date DESC,
                    d.created_at DESC

                LIMIT 5
            `)
            .bind(companyId)
            .all<RecentDocumentRow>();

        const recentPurchases = await c.env.DB
            .prepare(`
                SELECT
                    d.id,
                    d.document_number,
                    d.document_date,
                    p.display_name AS party_name,
                    d.status,
                    d.currency_code,
                    d.total_paise,
                    d.amount_paid_paise

                FROM documents d

                LEFT JOIN parties p
                    ON p.id = d.party_id
                    AND p.company_id =
                        d.company_id

                WHERE
                    d.company_id = ?
                    AND d.document_type =
                        'PURCHASE_ORDER'

                ORDER BY
                    d.document_date DESC,
                    d.created_at DESC

                LIMIT 5
            `)
            .bind(companyId)
            .all<RecentDocumentRow>();

        return c.json({
            success: true,

            summary: {
                currency_code:
                    metrics.currency_code,

                total_sales_paise:
                    metrics.total_sales_paise,

                total_purchases_paise:
                    metrics.total_purchases_paise,

                outstanding_sales_paise:
                    metrics.outstanding_sales_paise,

                this_month_sales_paise:
                    metrics.this_month_sales_paise,

                this_month_purchases_paise:
                    metrics.this_month_purchases_paise,

                customer_count:
                    metrics.customer_count,
            },

            recent_sales:
                recentSales.results,

            recent_purchases:
                recentPurchases.results,
        });
    }
}