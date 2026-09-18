import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { generateDocumentNumber } from "../utils/documents/numberGenerator";
import { createAuditLog } from "../utils/audit/auditLog";
import {
    calculateDocument,
} from "../utils/documents/calculateDocument";
import { isValidGstStatePair } from "../utils/gstStates";

const DocumentItemRequest = z
    .object({
        product_id: z.string().uuid().optional(),
        item_name: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        hsn_sac: z.string().max(20).optional(),
        unit: z.string().min(1).max(20),
        quantity_milli: z.number().int().positive(),
        rate_paise: z.number().int().nonnegative(),
        discount_paise: z.number().int().nonnegative().default(0),
        gst_rate_bps: z.number().int().min(0).max(10000).optional(),
        cess_rate_bps: z.number().int().min(0).max(10000).optional(),
    })
    .superRefine((item, ctx) => {
        const grossPaise = Math.floor(
            (item.quantity_milli * item.rate_paise) / 1000,
        );

        if (item.discount_paise > grossPaise) {
            ctx.addIssue({
                code: "custom",
                path: ["discount_paise"],
                message: "Discount cannot exceed the line gross amount.",
            });
        }
    });

const DocumentCreateRequest = z.object({
    document_type: z.enum([
        "TAX_INVOICE",
        "PROFORMA_INVOICE",
        "PURCHASE_ORDER",
        "QUOTATION",
        "DELIVERY_CHALLAN",
    ]),
    document_date: z.string().date(),
    due_date: z.string().date().optional(),
    party_id: z.string().uuid().optional(),
    place_of_supply_state: z.string().max(100).optional(),
    place_of_supply_state_code: z.string().max(10).optional(),
    supply_type: z.string().max(50).optional(),
    currency_code: z.string().length(3).default("INR"),
    notes: z.string().max(10000).optional(),
    terms_and_conditions: z.string().max(10000).optional(),
    reference_number: z.string().max(100).optional(),
    items: z.array(DocumentItemRequest).min(1).max(500),
        }).superRefine((document, ctx) => {
            const state =
                document.place_of_supply_state?.trim() ?? "";

            const stateCode =
                document.place_of_supply_state_code?.trim() ?? "";

            if (!state && !stateCode) {
                return;
            }

            if (!state || !stateCode) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: !state
                        ? ["place_of_supply_state"]
                        : ["place_of_supply_state_code"],
                    message:
                        "Place of supply state and state code must both be provided.",
                });

                return;
            }

            if (!isValidGstStatePair(state, stateCode)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["place_of_supply_state_code"],
                    message:
                        "Place of supply state and state code do not match.",
                });
            }
        });

type ProductRow = {
    id: string;
    name: string;
    description: string | null;
    hsn_sac: string | null;
    unit: string;
    gst_rate_bps: number;
    cess_rate_bps: number;
};

type PartyRow = {
    id: string;
    display_name: string;
    gstin: string | null;
    state_code: string | null;
};

export class DocumentCreate extends OpenAPIRoute {
    schema = {
        tags: ["Documents"],
        summary: "Create a billing document",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: DocumentCreateRequest,
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Document created successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            document: z.object({
                                id: z.string(),
                                document_type: z.string(),
                                document_number: z.string(),
                                document_date: z.string(),
                                status: z.string(),
                                total_paise: z.number(),
                            }),
                        }),
                    },
                },
            },
            "400": {
                description: "Invalid document data",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Party or product not found",
            },
        },
    };

    async handle(c: AppContext) {
        const companyId = c.get("companyId");
        const userId = c.get("userId");

        if (!companyId || !userId) {
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

        /*
        * Validate that the document uses the correct party role.
        *
        * Sales documents must use a CUSTOMER.
        * Purchase orders must use a VENDOR.
        */
        const expectedPartyRole =
            body.document_type === "PURCHASE_ORDER"
                ? "VENDOR"
                : "CUSTOMER";

        if (!body.party_id) {
            return c.json(
                {
                    success: false,
                    message:
                        expectedPartyRole === "VENDOR"
                            ? "Please select a vendor."
                            : "Please select a customer.",
                },
                400,
            );
        }

        const party = await c.env.DB
            .prepare(`
                SELECT
                    p.id,
                    p.display_name,
                    p.gstin,
                    (
                        SELECT pa.state_code
                        FROM party_addresses pa
                        WHERE pa.party_id = p.id
                        ORDER BY
                            pa.is_default DESC,
                            pa.created_at ASC
                        LIMIT 1
                    ) AS state_code
                FROM parties p
                INNER JOIN party_roles pr
                    ON pr.party_id = p.id
                WHERE p.id = ?
                    AND p.company_id = ?
                    AND p.is_active = 1
                    AND pr.role = ?
                LIMIT 1
            `)
            .bind(
                body.party_id,
                companyId,
                expectedPartyRole,
            )
            .first<PartyRow>();

        if (!party) {
            return c.json(
                {
                    success: false,
                    message:
                        expectedPartyRole === "VENDOR"
                            ? "Vendor not found"
                            : "Customer not found",
                },
                404,
            );
        }

        /*
         * Validate all referenced products belong to this company.
         * We also build a lookup so the item snapshot can use
         * product information where appropriate.
         */
        const productIds = [
            ...new Set(
                body.items
                    .map((item) => item.product_id)
                    .filter(
                        (id): id is string =>
                            typeof id === "string",
                    ),
            ),
        ];

        const productMap = new Map<string, ProductRow>();

        for (const productId of productIds) {
            const product = await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        name,
                        description,
                        hsn_sac,
                        unit,
                        gst_rate_bps,
                        cess_rate_bps
                    FROM products
                    WHERE id = ?
                        AND company_id = ?
                        AND is_active = 1
                    LIMIT 1
                `)
                .bind(productId, companyId)
                .first<ProductRow>();

            if (!product) {
                return c.json(
                    {
                        success: false,
                        message: `Product not found: ${productId}`,
                    },
                    404,
                );
            }

            productMap.set(productId, product);
        }

        /*
        * Determine tax treatment.
        *
        * Sales:
        *   supplier = our company
        *
        * Purchase Order:
        *   supplier = vendor
        *
        * Supplier state matching place of supply gives
        * CGST + SGST; otherwise IGST.
        *
        * If either state code is unavailable, we
        * conservatively fall back to IGST.
        */
        const company = await c.env.DB
            .prepare(`
                SELECT
                    state_code,
                    gstin
                FROM companies
                WHERE id = ?
                    AND is_active = 1
                LIMIT 1
            `)
            .bind(companyId)
            .first<{
                state_code: string | null;
                gstin: string | null;
            }>();

        if (!company) {
            return c.json(
                {
                    success: false,
                    message: "Company not found",
                },
                400,
            );
        }

        const companyStateCode =
            company.state_code ??
            company.gstin?.slice(0, 2) ??
            null;

        const partyStateCode =
            party.state_code ??
            party.gstin?.slice(0, 2) ??
            null;

        /*
        * For sales, our company is the supplier.
        * For a purchase order, the vendor is the supplier.
        */
        const supplierStateCode =
            body.document_type === "PURCHASE_ORDER"
                ? partyStateCode
                : companyStateCode;

        const isIntraState = Boolean(
            supplierStateCode &&
            body.place_of_supply_state_code &&
            supplierStateCode ===
                body.place_of_supply_state_code,
        );

        /*
         * Calculate every item on the server.
         *
         * quantity_milli:
         *   1000 = 1 unit
         *
         * rate_paise:
         *   ₹100 = 10,000 paise
         *
         * percentage rates:
         *   1800 bps = 18%
         */
        const calculatedItemsInput =
            body.items.map((item) => {
                const product = item.product_id
                    ? productMap.get(item.product_id)
                    : undefined;

                return {
                    quantity_milli:
                        item.quantity_milli,
                    rate_paise:
                        item.rate_paise,
                    discount_paise:
                        item.discount_paise,
                    gst_rate_bps:
                        product?.gst_rate_bps ??
                        item.gst_rate_bps ??
                        0,
                    cess_rate_bps:
                        product?.cess_rate_bps ??
                        item.cess_rate_bps ??
                        0,
                };
            });

        const calculation =
            calculateDocument(
                calculatedItemsInput,
                isIntraState,
            );

        const calculatedItems =
            calculation.items.map(
                (calculated, index) => ({
                    ...calculated,
                    item: body.items[index]!,
                }),
            );

        const {
            subtotalPaise,
            discountPaise,
            taxableAmountPaise,
            cgstPaise,
            sgstPaise,
            igstPaise,
            cessPaise,
            totalPaise,
        } = calculation;

        const documentDate =
            new Date(
                `${body.document_date}T00:00:00.000Z`,
            );

        const {
            documentNumber,
        } = await generateDocumentNumber(
            c.env.DB,
            companyId,
            body.document_type,
            documentDate,
        );

        const documentId =
            crypto.randomUUID();

        const now =
            new Date().toISOString();

        const documentInsert =
            c.env.DB.prepare(`
                INSERT INTO documents (
                    id,
                    company_id,
                    document_type,
                    document_number,
                    document_date,
                    due_date,
                    party_id,
                    status,
                    currency_code,
                    place_of_supply_state,
                    place_of_supply_state_code,
                    supply_type,
                    subtotal_paise,
                    discount_paise,
                    taxable_amount_paise,
                    cgst_paise,
                    sgst_paise,
                    igst_paise,
                    cess_paise,
                    round_off_paise,
                    total_paise,
                    amount_paid_paise,
                    notes,
                    terms_and_conditions,
                    reference_number,
                    source_document_id,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'DRAFT',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    0,
                    ?,
                    0,
                    ?,
                    ?,
                    ?,
                    NULL,
                    ?,
                    ?,
                    ?
                )
            `)
                .bind(
                    documentId,
                    companyId,
                    body.document_type,
                    documentNumber,
                    body.document_date,
                    body.due_date ?? null,
                    body.party_id ?? null,
                    body.currency_code.toUpperCase(),
                    body.place_of_supply_state ??
                    null,
                    body.place_of_supply_state_code ??
                    null,
                    body.supply_type ?? null,
                    subtotalPaise,
                    discountPaise,
                    taxableAmountPaise,
                    cgstPaise,
                    sgstPaise,
                    igstPaise,
                    cessPaise,
                    totalPaise,
                    body.notes ?? null,
                    body.terms_and_conditions ??
                    null,
                    body.reference_number ?? null,
                    userId,
                    now,
                    now,
                );

        const statements = [
            documentInsert,
        ];

        for (const calculated of calculatedItems) {
            const product =
                calculated.item.product_id
                    ? productMap.get(
                        calculated.item
                            .product_id,
                    )
                    : undefined;

            const itemName =
                calculated.item.item_name;

            const description =
                calculated.item.description ??
                product?.description ??
                null;

            const hsnSac =
                calculated.item.hsn_sac ??
                product?.hsn_sac ??
                null;

            const unit =
                calculated.item.unit ??
                product?.unit ??
                null;

            statements.push(
                c.env.DB.prepare(`
                    INSERT INTO document_items (
                        id,
                        document_id,
                        product_id,
                        line_number,
                        item_name,
                        description,
                        hsn_sac,
                        unit,
                        quantity_milli,
                        rate_paise,
                        discount_rate_bps,
                        discount_paise,
                        taxable_amount_paise,
                        gst_rate_bps,
                        cgst_rate_bps,
                        sgst_rate_bps,
                        igst_rate_bps,
                        cgst_paise,
                        sgst_paise,
                        igst_paise,
                        cess_rate_bps,
                        cess_paise,
                        total_paise,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                `).bind(
                    crypto.randomUUID(),
                    documentId,
                    calculated.item.product_id ??
                    null,
                    calculated.lineNumber,
                    itemName,
                    description,
                    hsnSac,
                    unit,
                    calculated.item
                        .quantity_milli,
                    calculated.item
                        .rate_paise,
                    0,
                    calculated.discountPaise,
                    calculated.taxableAmountPaise,
                    calculated.gstRateBps,
                    calculated.cgstRateBps,
                    calculated.sgstRateBps,
                    calculated.igstRateBps,
                    calculated.cgstPaise,
                    calculated.sgstPaise,
                    calculated.igstPaise,
                    calculated.cessRateBps,
                    calculated.cessPaise,
                    calculated.totalPaise,
                    now,
                    now,
                ),
            );
        }

        await c.env.DB.batch(statements);

        /*
         * Record the successful document creation.
         *
         * The document and all its items have already been
         * persisted successfully before this audit event is written.
         */
        await createAuditLog(c.env.DB, {
            companyId,
            userId,
            entityType: "DOCUMENT",
            entityId: documentId,
            action: "DOCUMENT_CREATED",
            metadata: {
                document_type: body.document_type,
                document_number: documentNumber,
                status: "DRAFT",
                total_paise: totalPaise,
                item_count: calculatedItems.length,
            },
        });

        return c.json(
            {
                success: true,
                document: {
                    id: documentId,
                    document_type:
                        body.document_type,
                    document_number:
                        documentNumber,
                    document_date:
                        body.document_date,
                    status: "DRAFT",
                    total_paise: totalPaise,
                },
            },
            201,
        );
    }
}