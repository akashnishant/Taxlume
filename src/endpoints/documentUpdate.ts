import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import {
    calculateDocument,
} from "../utils/documents/calculateDocument";
import { isValidGstStatePair } from "../utils/gstStates";

const DocumentItemUpdateRequest = z
    .object({
        product_id: z.string().uuid().nullable().optional(),
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

const DocumentUpdateRequest = z.object({
    document_date: z.string().date().optional(),
    due_date: z.string().date().nullable().optional(),
    party_id: z.string().uuid().nullable().optional(),
    place_of_supply_state: z.string().max(100).nullable().optional(),
    place_of_supply_state_code: z.string().max(10).nullable().optional(),
    supply_type: z.string().max(50).nullable().optional(),
    currency_code: z.string().length(3).optional(),
    notes: z.string().max(10000).nullable().optional(),
    terms_and_conditions: z.string().max(10000).nullable().optional(),
    reference_number: z.string().max(100).nullable().optional(),
    items: z.array(DocumentItemUpdateRequest).min(1).max(500).optional(),
});

export class DocumentUpdate extends OpenAPIRoute {
    schema = {
        tags: ["Documents"],
        summary: "Update a draft billing document",
        request: {
            params: z.object({
                id: z.string().uuid(),
            }),
            body: {
                content: {
                    "application/json": {
                        schema: DocumentUpdateRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Document updated successfully",
            },
            "400": {
                description: "Invalid document data",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Document not found",
            },
            "409": {
                description: "Document cannot be modified",
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

        const { id } = data.params;
        const body = data.body;

        const document = await c.env.DB
            .prepare(`
                SELECT
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
                    notes,
                    terms_and_conditions,
                    reference_number,
                    subtotal_paise,
                    discount_paise,
                    taxable_amount_paise,
                    cgst_paise,
                    sgst_paise,
                    igst_paise,
                    cess_paise,
                    total_paise
                FROM documents
                WHERE id = ?
                    AND company_id = ?
                LIMIT 1
            `)
            .bind(id, companyId)
            .first<{
                id: string;
                company_id: string;
                document_type: string;
                document_number: string;
                document_date: string;
                due_date: string | null;
                party_id: string | null;
                status: string;
                currency_code: string;
                place_of_supply_state: string | null;
                place_of_supply_state_code: string | null;
                supply_type: string | null;
                notes: string | null;
                terms_and_conditions: string | null;
                reference_number: string | null;
                subtotal_paise: number;
                discount_paise: number;
                taxable_amount_paise: number;
                cgst_paise: number;
                sgst_paise: number;
                igst_paise: number;
                cess_paise: number;
                total_paise: number;
            }>();

        if (!document) {
            return c.json(
                {
                    success: false,
                    message: "Document not found",
                },
                404,
            );
        }

        if (document.status !== "DRAFT") {
            return c.json(
                {
                    success: false,
                    message: `Only DRAFT documents can be modified. Current status: ${document.status}`,
                },
                409,
            );
        }

        const placeOfSupplyChanged =
            (body.place_of_supply_state !== undefined &&
                body.place_of_supply_state !==
                    document.place_of_supply_state) ||
            (body.place_of_supply_state_code !== undefined &&
                body.place_of_supply_state_code !==
                    document.place_of_supply_state_code);
        const partyChanged =
            body.party_id !== undefined &&
            body.party_id !== document.party_id;

        if (
            (
                placeOfSupplyChanged ||
                (
                    document.document_type === "PURCHASE_ORDER" &&
                    partyChanged
                )
            ) &&
            !body.items
        ) {
            return c.json({
                success: false,
                message:
                    "Items must be provided when the place of supply or purchase-order vendor changes so that GST can be recalculated.",
            }, 400);
        }

        if (body.party_id !== undefined) {
            if (body.party_id === null) {
                return c.json(
                    {
                        success: false,
                        message:
                            document.document_type === "PURCHASE_ORDER"
                                ? "Please select a vendor."
                                : "Please select a customer.",
                    },
                    400,
                );
            }
            const expectedPartyRole =
                document.document_type === "PURCHASE_ORDER"
                    ? "VENDOR"
                    : "CUSTOMER";

            const party = await c.env.DB
                .prepare(`
                    SELECT
                        p.id,
                        p.is_active,
                        pr.role
                    FROM parties p
                    INNER JOIN party_roles pr
                        ON pr.party_id = p.id
                    WHERE p.id = ?
                        AND p.company_id = ?
                        AND pr.role = ?
                    LIMIT 1
                `)
                .bind(
                    body.party_id,
                    companyId,
                    expectedPartyRole,
                )
                .first<{
                    id: string;
                    is_active: number;
                    role: string;
                }>();

            if (!party) {
                return c.json(
                    {
                        success: false,
                        message:
                            `Selected party is not a valid ${expectedPartyRole.toLowerCase()} for ${document.document_type}.`,
                    },
                    400,
                );
            }

            if (
                party.is_active !== 1 &&
                body.party_id !== document.party_id
            ) {
                return c.json(
                    {
                        success: false,
                        message:
                            document.document_type === "PURCHASE_ORDER"
                                ? "Vendor not found or inactive"
                                : "Customer not found or inactive",
                    },
                    400,
                );
            }
        }

        const productMap = new Map<
            string,
            {
                id: string;
                description: string | null;
                hsn_sac: string | null;
                unit: string;
                gst_rate_bps: number;
                cess_rate_bps: number;
            }
        >();

        if (body.items) {
            const existingProductRows = await c.env.DB
                .prepare(`
                    SELECT DISTINCT product_id
                    FROM document_items
                    WHERE document_id = ?
                        AND product_id IS NOT NULL
                `)
                .bind(document.id)
                .all<{
                    product_id: string;
                }>();

            const existingProductIds = new Set(
                existingProductRows.results.map(
                    (row) => row.product_id,
                ),
            );
            const productIds = [
                ...new Set(
                    body.items
                        .map((item) => item.product_id)
                        .filter(
                            (productId): productId is string =>
                                Boolean(productId),
                        ),
                ),
            ];

            for (const productId of productIds) {
                const product = await c.env.DB
                    .prepare(`
                        SELECT
                            id,
                            description,
                            hsn_sac,
                            unit,
                            gst_rate_bps,
                            cess_rate_bps,
                            is_active
                        FROM products
                        WHERE id = ?
                            AND company_id = ?
                        LIMIT 1
                    `)
                    .bind(productId, companyId)
                    .first<{
                        id: string;
                        description: string | null;
                        hsn_sac: string | null;
                        unit: string;
                        gst_rate_bps: number;
                        cess_rate_bps: number;
                        is_active: number;
                    }>();

                if (!product) {
                    return c.json(
                        {
                            success: false,
                            message: `Product not found: ${productId}`,
                        },
                        400,
                    );
                }

                if (
                    product.is_active !== 1 &&
                    !existingProductIds.has(productId)
                ) {
                    return c.json(
                        {
                            success: false,
                            message: `Product not found or inactive: ${productId}`,
                        },
                        400,
                    );
                }

                productMap.set(product.id, product);
            }
        }

        const now = new Date().toISOString();

        let calculation:
            ReturnType<typeof calculateDocument> | null =
            null;

        if (body.items) {
            const updatedPlaceOfSupplyStateCode =
                body.place_of_supply_state_code !== undefined
                    ? body.place_of_supply_state_code
                    : document.place_of_supply_state_code;

            const company = await c.env.DB
            .prepare(`
                SELECT
                    state_code,
                    gstin
                FROM companies
                WHERE id = ?
                LIMIT 1
            `)
            .bind(companyId)
            .first<{
                state_code: string | null;
                gstin: string | null;
            }>();

        const companyStateCode =
            company?.state_code ??
            company?.gstin?.slice(0, 2) ??
            null;

        let supplierStateCode =
            companyStateCode;

        if (
            document.document_type ===
            "PURCHASE_ORDER"
        ) {
            const effectivePartyId =
                body.party_id !== undefined
                    ? body.party_id
                    : document.party_id;

            if (!effectivePartyId) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Please select a vendor.",
                    },
                    400,
                );
            }

            const vendor = await c.env.DB
                .prepare(`
                    SELECT
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
                                AND pr.role = 'VENDOR'
                            LIMIT 1
                        `)
                        .bind(
                            effectivePartyId,
                            companyId,
                        )
                        .first<{
                            gstin: string | null;
                            state_code: string | null;
                        }>();

                    if (!vendor) {
                        return c.json(
                            {
                                success: false,
                                message:
                                    "Vendor not found",
                            },
                            400,
                        );
                    }

                    supplierStateCode =
                        vendor.state_code ??
                        vendor.gstin?.slice(0, 2) ??
                        null;
                }

                const isIntraState = Boolean(
                    supplierStateCode &&
                    updatedPlaceOfSupplyStateCode &&
                    supplierStateCode ===
                        updatedPlaceOfSupplyStateCode,
                );

            const calculationInput =
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

            calculation = calculateDocument(
                calculationInput,
                isIntraState,
            );
        }

        const updatedDocumentDate =
            body.document_date ?? document.document_date;

        const updatedDueDate =
            body.due_date !== undefined
                ? body.due_date
                : document.due_date;

        const updatedPartyId =
            body.party_id !== undefined
                ? body.party_id
                : document.party_id;

        const updatedPlaceOfSupplyState =
            body.place_of_supply_state !== undefined
                ? body.place_of_supply_state
                : document.place_of_supply_state;

        const updatedPlaceOfSupplyStateCode =
            body.place_of_supply_state_code !== undefined
                ? body.place_of_supply_state_code
                : document.place_of_supply_state_code;

        const normalizedPlaceOfSupplyState =
            updatedPlaceOfSupplyState?.trim() ?? "";

        const normalizedPlaceOfSupplyStateCode =
            updatedPlaceOfSupplyStateCode?.trim() ?? "";

        if (
            Boolean(normalizedPlaceOfSupplyState) !==
            Boolean(normalizedPlaceOfSupplyStateCode)
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Place of supply state and state code must both be provided.",
                },
                400,
            );
        }

        if (
            normalizedPlaceOfSupplyState &&
            normalizedPlaceOfSupplyStateCode &&
            !isValidGstStatePair(
                normalizedPlaceOfSupplyState,
                normalizedPlaceOfSupplyStateCode,
            )
        ) {
            return c.json(
                {
                    success: false,
                    message:
                        "Place of supply state and state code do not match.",
                },
                400,
            );
        }

        const updatedSupplyType =
            body.supply_type !== undefined
                ? body.supply_type
                : document.supply_type;

        const updatedCurrencyCode =
            body.currency_code !== undefined
                ? body.currency_code.toUpperCase()
                : document.currency_code;

        const updatedNotes =
            body.notes !== undefined
                ? body.notes
                : document.notes;

        const updatedTermsAndConditions =
            body.terms_and_conditions !== undefined
                ? body.terms_and_conditions
                : document.terms_and_conditions;

        const updatedReferenceNumber =
            body.reference_number !== undefined
                ? body.reference_number
                : document.reference_number;

        const documentUpdateStatement =
            c.env.DB
                .prepare(`
                UPDATE documents
                SET
                    document_date = ?,
                    due_date = ?,
                    party_id = ?,
                    currency_code = ?,
                    place_of_supply_state = ?,
                    place_of_supply_state_code = ?,
                    supply_type = ?,
                    subtotal_paise = ?,
                    discount_paise = ?,
                    taxable_amount_paise = ?,
                    cgst_paise = ?,
                    sgst_paise = ?,
                    igst_paise = ?,
                    cess_paise = ?,
                    total_paise = ?,
                    notes = ?,
                    terms_and_conditions = ?,
                    reference_number = ?,
                    updated_at = ?
                WHERE id = ?
                    AND company_id = ?
                    AND status = 'DRAFT'
            `)
            .bind(
                updatedDocumentDate,
                updatedDueDate,
                updatedPartyId,
                updatedCurrencyCode,
                updatedPlaceOfSupplyState,
                updatedPlaceOfSupplyStateCode,
                updatedSupplyType,
                calculation?.subtotalPaise ?? document.subtotal_paise,
                calculation?.discountPaise ?? document.discount_paise,
                calculation?.taxableAmountPaise ?? document.taxable_amount_paise,
                calculation?.cgstPaise ?? document.cgst_paise,
                calculation?.sgstPaise ?? document.sgst_paise,
                calculation?.igstPaise ?? document.igst_paise,
                calculation?.cessPaise ?? document.cess_paise,
                calculation?.totalPaise ?? document.total_paise,
                updatedNotes,
                updatedTermsAndConditions,
                updatedReferenceNumber,
                now,
                document.id,
                companyId,
            );

        const itemStatements: D1PreparedStatement[] = [];

        if (body.items && calculation) {
            itemStatements.push(
                c.env.DB
                    .prepare(`
                        DELETE FROM document_items
                        WHERE document_id = ?
                    `)
                    .bind(document.id),
            );

            for (let index = 0; index < calculation.items.length; index++) {
                const calculated = calculation.items[index]!;
                const item = body.items[index]!;

                const product = item.product_id
                    ? productMap.get(item.product_id)
                    : undefined;

                itemStatements.push(
                    c.env.DB
                        .prepare(`
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
                                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?
                            )
                        `)
                        .bind(
                            crypto.randomUUID(),
                            document.id,
                            item.product_id ?? null,
                            calculated.lineNumber,
                            item.item_name,
                            item.description ??
                                product?.description ??
                                null,
                            item.hsn_sac ??
                                product?.hsn_sac ??
                                null,
                            item.unit ??
                                product?.unit ??
                                "NOS",
                            item.quantity_milli,
                            item.rate_paise,
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
        }

        const auditStatement = c.env.DB
        .prepare(`
            INSERT INTO audit_logs (
                id,
                company_id,
                user_id,
                entity_type,
                entity_id,
                action,
                metadata_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
            crypto.randomUUID(),
            companyId,
            userId,
            "DOCUMENT",
            document.id,
            "DOCUMENT_UPDATED",
            JSON.stringify({
                document_type: document.document_type,
                document_number: document.document_number,
                updated_fields: Object.keys(body),
            }),
            now,
        );

        await c.env.DB.batch([
            documentUpdateStatement,
            ...itemStatements,
            auditStatement,
        ]);

        return c.json({
            success: true,
            message: "Document updated successfully",
            document: {
                id: document.id,
                document_type: document.document_type,
                document_number: document.document_number,
                document_date: updatedDocumentDate,
                status: "DRAFT",
                updated_at: now,
            },
        });
    }
}