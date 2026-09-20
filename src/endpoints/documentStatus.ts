import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { validateDocumentForIssuance } from "../utils/documents/validation";
import { prepareAuditLog } from "../utils/audit/auditLog";
import { calculateDocument } from "../utils/documents/calculateDocument";
import {
    copyDocumentAsset,
    type CompanySnapshot,
    type PartySnapshot,
    type PaymentSnapshot,
} from "../utils/documents/documentSnapshot";

const DocumentStatusParams = z.object({
    id: z.string().uuid(),
});

const DocumentStatusRequest = z.object({
    status: z.enum(["ISSUED", "CANCELLED"]),
});

type DocumentRow = {
    id: string;
    company_id: string;
    document_type: string;
    document_number: string;
    status: "DRAFT" | "ISSUED" | "CANCELLED";
    party_id: string | null;
    subtotal_paise: number;
    discount_paise: number;
    taxable_amount_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    cess_paise: number;
    total_paise: number;
    amount_paid_paise: number;
    place_of_supply_state: string | null;
    place_of_supply_state_code: string | null;
};

type CompanyRow = {
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
    currency_code: string;
    signature_key: string | null;
};

type PartyRow = {
    id: string;
    display_name: string;
    legal_name: string | null;
    gstin: string | null;
    pan: string | null;
    email: string | null;
    phone: string | null;
    alternate_phone: string | null;
    contact_person: string | null;
    role: string | null;
};

type PartyAddressRow = {
    address_type: string;
    label: string | null;
    address_line1: string;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    state_code: string | null;
    pincode: string | null;
    country: string;
    is_default: number;
};

type PaymentDetailsRow = {
    bank_name: string | null;
    account_holder_name: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    branch_name: string | null;
    upi_id: string | null;
    qr_code_key: string | null;
    show_qr_on_invoice: number;
};

export class DocumentStatus extends OpenAPIRoute {
    schema = {
        tags: ["Documents"],
        summary: "Change billing document status",
        request: {
            params: DocumentStatusParams,
            body: {
                content: {
                    "application/json": {
                        schema: DocumentStatusRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Document status updated successfully",
            },
            "400": {
                description:
                    "Invalid status transition or document validation failed",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Document not found",
            },
            "409": {
                description: "Invoice has recorded payments and cannot be cancelled",
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

        const { params, body } =
            await this.getValidatedData<typeof this.schema>();

        const { id } = params;
        const requestedStatus = body.status;

        const document =
            await c.env.DB
                .prepare(`
                    SELECT
                        id,
                        company_id,
                        document_type,
                        document_number,
                        status,
                        party_id,
                        subtotal_paise,
                        discount_paise,
                        taxable_amount_paise,
                        cgst_paise,
                        sgst_paise,
                        igst_paise,
                        cess_paise,
                        total_paise,
                        amount_paid_paise,
                        place_of_supply_state,
                        place_of_supply_state_code
                    FROM documents
                    WHERE id = ?
                        AND company_id = ?
                    LIMIT 1
                `)
                .bind(id, companyId)
                .first<DocumentRow>();

        if (!document) {
            return c.json(
                {
                    success: false,
                    message: "Document not found",
                },
                404,
            );
        }

        const currentStatus = document.status;

        const validTransition =
            (currentStatus === "DRAFT" &&
                (requestedStatus === "ISSUED" ||
                    requestedStatus === "CANCELLED")) ||
            (currentStatus === "ISSUED" &&
                requestedStatus === "CANCELLED");

        if (!validTransition) {
            return c.json(
                {
                    success: false,
                    message:
                        `Invalid status transition: ${currentStatus} -> ${requestedStatus}`,
                },
                400,
            );
        }

        if (
            currentStatus === "ISSUED" &&
            requestedStatus === "CANCELLED" &&
            document.document_type === "TAX_INVOICE"
            ) {
            const receiptHistory = await c.env.DB
                .prepare(
                `
                    SELECT 1 AS has_receipt
                    FROM invoice_receipts
                    WHERE company_id = ?
                    AND document_id = ?
                    LIMIT 1
                `,
                )
                .bind(companyId, document.id)
                .first<{ has_receipt: number }>();

            if (document.amount_paid_paise > 0 || receiptHistory) {
                return c.json(
                {
                    success: false,
                    message:
                    "This invoice has recorded payments and cannot be cancelled. Review its payment history before proceeding.",
                },
                409,
                );
            }
        }

        /*
         * Issuance validation is performed only when moving
         * a document from DRAFT to ISSUED.
         *
         * Cancellation does not require the same validation because
         * the purpose of cancellation is to invalidate an existing
         * document rather than issue a new one.
         */

        let snapshotStatement: D1PreparedStatement | null = null;

        let copiedSignatureKey: string | null = null;
        let copiedPaymentQrKey: string | null = null;
        if (
            currentStatus === "DRAFT" &&
            requestedStatus === "ISSUED"
        ) {
            const company =
                await c.env.DB
                    .prepare(`
                        SELECT
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
                            signature_key
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
                        message: "Company not found or inactive",
                    },
                    400,
                );
            }

            let party: {
                displayName: string | null;
                gstin: string | null;
                role: string | null;
                addresses: PartyAddressRow[];
            } | null = null;

            let partySnapshot: PartySnapshot | null = null;

            if (document.party_id) {
                const expectedPartyRole =
                    document.document_type === "PURCHASE_ORDER"
                        ? "VENDOR"
                        : "CUSTOMER";
                const partyRow =
                    await c.env.DB
                        .prepare(`
                            SELECT
                                p.id,
                                p.display_name,
                                p.legal_name,
                                p.gstin,
                                p.pan,
                                p.email,
                                p.phone,
                                p.alternate_phone,
                                p.contact_person,
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
                            document.party_id,
                            companyId,
                            expectedPartyRole,
                        )
                        .first<PartyRow>();

                if (partyRow) {
                    const addressResult =
                        await c.env.DB
                            .prepare(`
                                SELECT
                                    address_type,
                                    label,
                                    address_line1,
                                    address_line2,
                                    city,
                                    state,
                                    state_code,
                                    pincode,
                                    country,
                                    is_default
                                FROM party_addresses
                                WHERE party_id = ?
                                ORDER BY
                                    is_default DESC,
                                    created_at ASC
                            `)
                            .bind(document.party_id)
                            .all<PartyAddressRow>();

                    partySnapshot = {
                        id: partyRow.id,
                        display_name: partyRow.display_name,
                        legal_name: partyRow.legal_name,
                        gstin: partyRow.gstin,
                        pan: partyRow.pan,
                        email: partyRow.email,
                        phone: partyRow.phone,
                        alternate_phone: partyRow.alternate_phone,
                        contact_person: partyRow.contact_person,
                        role: partyRow.role,
                        addresses: addressResult.results.map((address) => ({
                            address_type: address.address_type,
                            label: address.label,
                            address_line1: address.address_line1,
                            address_line2: address.address_line2,
                            city: address.city,
                            state: address.state,
                            state_code: address.state_code,
                            pincode: address.pincode,
                            country: address.country,
                            is_default: address.is_default === 1,
                        })),
                    };

                    party = {
                        displayName: partyRow.display_name,
                        gstin: partyRow.gstin,
                        role: partyRow.role,
                        addresses: addressResult.results,
                    };
                }
            }

            const paymentDetails =
                await c.env.DB
                    .prepare(`
                        SELECT
                            bank_name,
                            account_holder_name,
                            account_number,
                            ifsc_code,
                            branch_name,
                            upi_id,
                            qr_code_key,
                            show_qr_on_invoice
                        FROM company_payment_details
                        WHERE company_id = ?
                        LIMIT 1
                    `)
                    .bind(companyId)
                    .first<PaymentDetailsRow>();

            const itemCountResult =
                await c.env.DB
                    .prepare(`
                        SELECT COUNT(*) AS item_count
                        FROM document_items
                        WHERE document_id = ?
                    `)
                    .bind(document.id)
                    .first<{ item_count: number }>();

            const itemRows =
                await c.env.DB
                    .prepare(`
                        SELECT
                            quantity_milli,
                            rate_paise,
                            discount_rate_bps,
                            gst_rate_bps,
                            cess_rate_bps,
                            discount_paise,
                            taxable_amount_paise,
                            cgst_paise,
                            sgst_paise,
                            igst_paise,
                            cess_paise,
                            total_paise
                        FROM document_items
                        WHERE document_id = ?
                        ORDER BY line_number ASC
                    `)
                    .bind(document.id)
                    .all<{
                        quantity_milli: number;
                        rate_paise: number;
                        discount_rate_bps: number;
                        gst_rate_bps: number;
                        cess_rate_bps: number;
                        discount_paise: number;
                        taxable_amount_paise: number;
                        cgst_paise: number;
                        sgst_paise: number;
                        igst_paise: number;
                        cess_paise: number;
                        total_paise: number;
                    }>();

            const partyStateCode =
                party?.addresses.find(
                    (address) => address.is_default === 1,
                )?.state_code ??
                party?.addresses[0]?.state_code ??
                party?.gstin?.slice(0, 2) ??
                null;

            const supplierStateCode =
                document.document_type === "PURCHASE_ORDER"
                    ? partyStateCode
                    : company.state_code;

            if (!supplierStateCode?.trim()) {
                return c.json(
                    {
                        success: false,
                        message:
                            document.document_type === "PURCHASE_ORDER"
                                ? "Vendor state code is required before issuing a Purchase Order."
                                : "Company state code is required before issuing a document.",
                    },
                    400,
                );
            }

            if (!document.place_of_supply_state_code?.trim()) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Place of Supply state code is required before issuing a document.",
                    },
                    400,
                );
            }

            const isIntraState =
                supplierStateCode ===
                document.place_of_supply_state_code;

            const recalculated =
                calculateDocument(
                    itemRows.results.map((item) => ({
                        quantity_milli: item.quantity_milli,
                        rate_paise: item.rate_paise,
                        discount_paise: item.discount_paise,
                        gst_rate_bps: item.gst_rate_bps,
                        cess_rate_bps: item.cess_rate_bps,
                    })),
                    isIntraState,
                );
            
            const lineItemsMismatch =
                itemRows.results.some((item, index) => {
                    const calculated = recalculated.items[index];

                    return (
                        !calculated ||
                        item.discount_paise !==
                            calculated.discountPaise ||
                        item.taxable_amount_paise !==
                            calculated.taxableAmountPaise ||
                        item.cgst_paise !==
                            calculated.cgstPaise ||
                        item.sgst_paise !==
                            calculated.sgstPaise ||
                        item.igst_paise !==
                            calculated.igstPaise ||
                        item.cess_paise !==
                            calculated.cessPaise ||
                        item.total_paise !==
                            calculated.totalPaise
                    );
                });

            if (lineItemsMismatch) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Document line items do not match their calculated values.",
                    },
                    400,
                );
            }

            const totalsMismatch =
                document.subtotal_paise !==
                    recalculated.subtotalPaise ||
                document.discount_paise !==
                    recalculated.discountPaise ||
                document.taxable_amount_paise !==
                    recalculated.taxableAmountPaise ||
                document.cgst_paise !==
                    recalculated.cgstPaise ||
                document.sgst_paise !==
                    recalculated.sgstPaise ||
                document.igst_paise !==
                    recalculated.igstPaise ||
                document.cess_paise !==
                    recalculated.cessPaise ||
                document.total_paise !==
                    recalculated.totalPaise;

            if (totalsMismatch) {
                return c.json(
                    {
                        success: false,
                        message:
                            "Document totals do not match the calculated totals from its items.",
                    },
                    400,
                );
            }

            const validation =
                validateDocumentForIssuance({
                    documentType: document.document_type,
                    status: currentStatus,
                    partyId: document.party_id,
                    company: {
                        legalName: company.legal_name,
                        gstin: company.gstin,
                        state: company.state,
                        stateCode: company.state_code,
                        addressLine1: company.address_line1,
                        city: company.city,
                        pincode: company.pincode,
                    },
                    party,
                    totalPaise: document.total_paise,
                    itemCount: itemCountResult?.item_count ?? 0,
                });

            if (!validation.valid) {
                return c.json(
                    {
                        success: false,
                        message: "Document cannot be issued",
                        errors: validation.errors,
                    },
                    400,
                );
            }

            const companySnapshot: CompanySnapshot = {
                legal_name: company.legal_name,
                trade_name: company.trade_name,
                gstin: company.gstin,
                pan: company.pan,
                email: company.email,
                phone: company.phone,
                website: company.website,
                address_line1: company.address_line1,
                address_line2: company.address_line2,
                city: company.city,
                state: company.state,
                state_code: company.state_code,
                pincode: company.pincode,
                country: company.country,
                currency_code: company.currency_code,
            };

            const paymentSnapshot: PaymentSnapshot | null =
                paymentDetails
                    ? {
                        bank_name: paymentDetails.bank_name,
                        account_holder_name:
                            paymentDetails.account_holder_name,
                        account_number:
                            paymentDetails.account_number,
                        ifsc_code:
                            paymentDetails.ifsc_code,
                        branch_name:
                            paymentDetails.branch_name,
                        upi_id:
                            paymentDetails.upi_id,
                        show_qr_on_invoice:
                            paymentDetails.show_qr_on_invoice === 1,
                    }
                    : null;

            try {
                copiedSignatureKey =
                    await copyDocumentAsset(
                        c.env.billdesk_files,
                        company.signature_key,
                        document.id,
                        "signature",
                    );

                copiedPaymentQrKey =
                    await copyDocumentAsset(
                        c.env.billdesk_files,
                        paymentDetails?.show_qr_on_invoice === 1
                            ? paymentDetails.qr_code_key
                            : null,
                        document.id,
                        "payment-qr",
                    );
            } catch (error) {
                if (copiedSignatureKey) {
                    try {
                        await c.env.billdesk_files.delete(
                            copiedSignatureKey,
                        );
                    } catch {
                        // Best-effort cleanup only.
                    }
                }

                if (copiedPaymentQrKey) {
                    try {
                        await c.env.billdesk_files.delete(
                            copiedPaymentQrKey,
                        );
                    } catch {
                        // Best-effort cleanup only.
                    }
                }

                throw error;
            }

            const issuedAt =
                new Date().toISOString();

            snapshotStatement =
                c.env.DB
                    .prepare(`
                        INSERT INTO document_snapshots (
                            document_id,
                            company_id,
                            snapshot_version,
                            company_snapshot_json,
                            party_snapshot_json,
                            payment_snapshot_json,
                            signature_key,
                            payment_qr_key,
                            issued_by,
                            issued_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `)
                    .bind(
                        document.id,
                        companyId,
                        1,
                        JSON.stringify(companySnapshot),
                        partySnapshot
                            ? JSON.stringify(partySnapshot)
                            : null,
                        paymentSnapshot
                            ? JSON.stringify(paymentSnapshot)
                            : null,
                        copiedSignatureKey,
                        copiedPaymentQrKey,
                        userId,
                        issuedAt,
                    );
        }

        const now = new Date().toISOString();

        const statusUpdateStatement =
    c.env.DB
        .prepare(`
            UPDATE documents
            SET
                status = ?,
                updated_at = ?
            WHERE id = ?
                AND company_id = ?
                AND status = ?
        `)
        .bind(
            requestedStatus,
            now,
            id,
            companyId,
            currentStatus,
        );

        const auditStatement =
            prepareAuditLog(c.env.DB, {
                companyId,
                userId,
                entityType: "DOCUMENT",
                entityId: document.id,
                action: `STATUS_${requestedStatus}`,
                metadata: {
                    document_type: document.document_type,
                    document_number: document.document_number,
                    previous_status: currentStatus,
                    new_status: requestedStatus,
                },
            });

        const statements = snapshotStatement
            ? [
                statusUpdateStatement,
                snapshotStatement,
                auditStatement,
            ]
            : [
                statusUpdateStatement,
                auditStatement,
            ];

        const cleanupCopiedSnapshotAssets =
            async () => {
                if (copiedSignatureKey) {
                    try {
                        await c.env.billdesk_files.delete(
                            copiedSignatureKey,
                        );
                    } catch {
                        // Best-effort cleanup only.
                        // Do not mask the original issuance error.
                    }
                }

                if (copiedPaymentQrKey) {
                    try {
                        await c.env.billdesk_files.delete(
                            copiedPaymentQrKey,
                        );
                    } catch {
                        // Best-effort cleanup only.
                        // Do not mask the original issuance error.
                    }
                }
            };

        let results;

        try {
            results =
                await c.env.DB.batch(statements);
        } catch (error) {
            await cleanupCopiedSnapshotAssets();

            const errorMessage =
                error instanceof Error ? error.message : String(error);

            if (
                requestedStatus === "CANCELLED" &&
                errorMessage.includes(
                "This invoice has recorded payments and cannot be cancelled.",
                )
            ) {
                return c.json(
                {
                    success: false,
                    message:
                    "This invoice has recorded payments and cannot be cancelled. Refresh the invoice to see its latest payment details.",
                },
                409,
                );
            }

            throw error;
        }

        const statusResult =
            results[0];

        const snapshotResult =
            snapshotStatement
                ? results[1]
                : null;

        const auditResult =
            snapshotStatement
                ? results[2]
                : results[1];

        if (
            !statusResult ||
            !auditResult ||
            !statusResult.success ||
            statusResult.meta.changes !== 1 ||
            !auditResult.success ||
            (snapshotStatement &&
                (!snapshotResult ||
                    !snapshotResult.success ||
                    snapshotResult.meta.changes !== 1))
        ) {
            await cleanupCopiedSnapshotAssets();
            return c.json(
                {
                    success: false,
                    message:
                        "Document status could not be updated",
                },
                400,
            );
        }

        return c.json({
            success: true,
            document: {
                id,
                previous_status: currentStatus,
                status: requestedStatus,
                updated_by: userId,
                updated_at: now,
            },
        });
    }
}