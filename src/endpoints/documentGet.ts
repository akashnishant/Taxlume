import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import type {
    CompanySnapshot,
    PartySnapshot,
    PaymentSnapshot,
} from "../utils/documents/documentSnapshot";

const DocumentGetParams = z.object({
    id: z.string().uuid(),
});

type DocumentRow = {
    id: string;
    company_id: string;
    document_type: string;
    document_number: string;
    document_date: string;
    due_date: string | null;
    party_id: string | null;
    party_name: string | null;
    party_legal_name: string | null;
    party_gstin: string | null;
    party_pan: string | null;
    party_email: string | null;
    party_phone: string | null;
    status: string;
    currency_code: string;
    place_of_supply_state: string | null;
    place_of_supply_state_code: string | null;
    supply_type: string | null;

    payment_terms_code: string | null;
    payment_terms_custom: string | null;
    customer_po_number: string | null;

    ship_to_same_as_bill_to: number | null;
    ship_to_name: string | null;
    ship_to_contact_person: string | null;
    ship_to_gstin: string | null;
    ship_to_phone: string | null;
    ship_to_email: string | null;
    ship_to_address_line1: string | null;
    ship_to_address_line2: string | null;
    ship_to_city: string | null;
    ship_to_state: string | null;
    ship_to_state_code: string | null;
    ship_to_pincode: string | null;
    ship_to_country: string | null;

    additional_charge_label: string | null;
    additional_charge_paise: number;
    additional_charge_taxable: number;
    additional_charge_gst_rate_bps: number;
    additional_charge_cgst_paise: number;
    additional_charge_sgst_paise: number;
    additional_charge_igst_paise: number;

    subtotal_paise: number;
    discount_paise: number;
    taxable_amount_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    cess_paise: number;
    round_off_paise: number;
    total_paise: number;
    amount_paid_paise: number;
    notes: string | null;
    terms_and_conditions: string | null;
    reference_number: string | null;
    source_document_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};

type DocumentItemRow = {
    id: string;
    product_id: string | null;
    line_number: number;
    item_name: string;
    description: string | null;
    hsn_sac: string | null;
    unit: string | null;
    quantity_milli: number;
    rate_paise: number;
    discount_rate_bps: number;
    discount_paise: number;
    taxable_amount_paise: number;
    gst_rate_bps: number;
    cgst_rate_bps: number;
    sgst_rate_bps: number;
    igst_rate_bps: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    cess_rate_bps: number;
    cess_paise: number;
    total_paise: number;
    created_at: string;
    updated_at: string;
};

type PartyAddressRow = {
    id: string;
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

type DocumentSnapshotRow = {
    snapshot_version: number;
    company_snapshot_json: string;
    party_snapshot_json: string | null;
    payment_snapshot_json: string | null;
    signature_key: string | null;
    payment_qr_key: string | null;
    issued_by: string | null;
    issued_at: string;
};

export class DocumentGet extends OpenAPIRoute {
    schema = {
        tags: ["Documents"],
        summary: "Get a billing document",
        request: {
            params: DocumentGetParams,
        },
        responses: {
            "200": {
                description: "Document retrieved successfully",
            },
            "401": {
                description: "Authentication required",
            },
            "404": {
                description: "Document not found",
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

        const { params } =
            await this.getValidatedData<typeof this.schema>();

        const { id } = params;

        const document =
            await c.env.DB
                .prepare(`
					SELECT
						d.id,
						d.company_id,
						d.document_type,
						d.document_number,
						d.document_date,
						d.due_date,
						d.party_id,
						p.display_name AS party_name,
						p.legal_name AS party_legal_name,
						p.gstin AS party_gstin,
						p.pan AS party_pan,
						p.email AS party_email,
						p.phone AS party_phone,
						d.status,
						d.currency_code,
						d.place_of_supply_state,
						d.place_of_supply_state_code,
						d.supply_type,
                                                d.payment_terms_code,
                                                d.payment_terms_custom,
                                                d.customer_po_number,

                                                d.ship_to_same_as_bill_to,
                                                d.ship_to_name,
                                                d.ship_to_contact_person,
                                                d.ship_to_gstin,
                                                d.ship_to_phone,
                                                d.ship_to_email,
                                                d.ship_to_address_line1,
                                                d.ship_to_address_line2,
                                                d.ship_to_city,
                                                d.ship_to_state,
                                                d.ship_to_state_code,
                                                d.ship_to_pincode,
                                                d.ship_to_country,

                                                d.additional_charge_label,
                                                d.additional_charge_paise,
                                                d.additional_charge_taxable,
                                                d.additional_charge_gst_rate_bps,
                                                d.additional_charge_cgst_paise,
                                                d.additional_charge_sgst_paise,
                                                d.additional_charge_igst_paise,

						d.subtotal_paise,
						d.discount_paise,
						d.taxable_amount_paise,
						d.cgst_paise,
						d.sgst_paise,
						d.igst_paise,
						d.cess_paise,
						d.round_off_paise,
						d.total_paise,
						d.amount_paid_paise,
						d.notes,
						d.terms_and_conditions,
						d.reference_number,
						d.source_document_id,
						d.created_by,
						d.created_at,
						d.updated_at
					FROM documents d
					LEFT JOIN parties p
						ON p.id = d.party_id
						AND p.company_id = d.company_id
					WHERE d.id = ?
						AND d.company_id = ?
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

        const items =
            await c.env.DB
                .prepare(`
					SELECT
						id,
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
					FROM document_items
					WHERE document_id = ?
					ORDER BY line_number ASC
				`)
                .bind(document.id)
                .all<DocumentItemRow>();

        let partyAddresses: PartyAddressRow[] = [];

        if (document.party_id) {
            const addressResult =
                await c.env.DB
                    .prepare(`
						SELECT
							id,
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
							address_type ASC,
							created_at ASC
					`)
                    .bind(document.party_id)
                    .all<PartyAddressRow>();

            partyAddresses =
                addressResult.results;
        }

        const snapshot =
    await c.env.DB
        .prepare(`
            SELECT
                snapshot_version,
                company_snapshot_json,
                party_snapshot_json,
                payment_snapshot_json,
                signature_key,
                payment_qr_key,
                issued_by,
                issued_at
            FROM document_snapshots
            WHERE
                document_id = ?
                AND company_id = ?
            LIMIT 1
        `)
        .bind(document.id, companyId)
        .first<DocumentSnapshotRow>();

        let parsedSnapshot: {
            snapshot_version: number;
            company: CompanySnapshot;
            party: PartySnapshot | null;
            payment: PaymentSnapshot | null;
            has_signature: boolean;
            has_payment_qr: boolean;
            issued_by: string | null;
            issued_at: string;
        } | null = null;

        if (snapshot) {
            try {
                parsedSnapshot = {
                    snapshot_version:
                        snapshot.snapshot_version,

                    company: JSON.parse(
                        snapshot.company_snapshot_json,
                    ) as CompanySnapshot,

                    party: snapshot.party_snapshot_json
                        ? (JSON.parse(
                            snapshot.party_snapshot_json,
                        ) as PartySnapshot)
                        : null,

                    payment: snapshot.payment_snapshot_json
                        ? (JSON.parse(
                            snapshot.payment_snapshot_json,
                        ) as PaymentSnapshot)
                        : null,

                    has_signature:
                        Boolean(snapshot.signature_key),

                    has_payment_qr:
                        Boolean(snapshot.payment_qr_key),

                    issued_by:
                        snapshot.issued_by,

                    issued_at:
                        snapshot.issued_at,
                };
            } catch {
                return c.json(
                    {
                        success: false,
                        message:
                            "Document snapshot data is invalid.",
                    },
                    500,
                );
            }
        }

        return c.json({
            success: true,
            document: {
                id: document.id,
                document_type: document.document_type,
                document_number: document.document_number,
                document_date: document.document_date,
                due_date: document.due_date,
                status: document.status,
                currency_code: document.currency_code,

                party: document.party_id
                    ? {
                        id: document.party_id,
                        display_name:
                            document.party_name,
                        legal_name:
                            document.party_legal_name,
                        gstin:
                            document.party_gstin,
                        pan:
                            document.party_pan,
                        email:
                            document.party_email,
                        phone:
                            document.party_phone,
                        addresses:
                            partyAddresses,
                    }
                    : null,

                place_of_supply: {
                    state:
                        document.place_of_supply_state,
                    state_code:
                        document.place_of_supply_state_code,
                },

                supply_type:
                    document.supply_type,

                payment_terms: {
                    code:
                        document.payment_terms_code,
                    custom:
                        document.payment_terms_custom,
                },

                customer_po_number:
                    document.customer_po_number,

                ship_to: {
                    same_as_bill_to:
                        document.ship_to_same_as_bill_to === null
                            ? null
                            : document.ship_to_same_as_bill_to === 1,
                    name:
                        document.ship_to_name,
                    contact_person:
                        document.ship_to_contact_person,
                    gstin:
                        document.ship_to_gstin,
                    phone:
                        document.ship_to_phone,
                    email:
                        document.ship_to_email,
                    address_line1:
                        document.ship_to_address_line1,
                    address_line2:
                        document.ship_to_address_line2,
                    city:
                        document.ship_to_city,
                    state:
                        document.ship_to_state,
                    state_code:
                        document.ship_to_state_code,
                    pincode:
                        document.ship_to_pincode,
                    country:
                        document.ship_to_country,
                },

                additional_charge: {
                    label:
                        document.additional_charge_label,
                    amount_paise:
                        document.additional_charge_paise,
                    taxable:
                        document.additional_charge_taxable === 1,
                    gst_rate_bps:
                        document.additional_charge_gst_rate_bps,
                    cgst_paise:
                        document.additional_charge_cgst_paise,
                    sgst_paise:
                        document.additional_charge_sgst_paise,
                    igst_paise:
                        document.additional_charge_igst_paise,
                    tax_paise:
                        document.additional_charge_cgst_paise +
                        document.additional_charge_sgst_paise +
                        document.additional_charge_igst_paise,
                },

                totals: {
                    subtotal_paise:
                        document.subtotal_paise,
                    discount_paise:
                        document.discount_paise,
                    taxable_amount_paise:
                        document.taxable_amount_paise,
                    cgst_paise:
                        document.cgst_paise,
                    sgst_paise:
                        document.sgst_paise,
                    igst_paise:
                        document.igst_paise,
                    cess_paise:
                        document.cess_paise,
                    round_off_paise:
                        document.round_off_paise,
                    total_paise:
                        document.total_paise,
                    amount_paid_paise:
                        document.amount_paid_paise,
                },

                notes: document.notes,
                terms_and_conditions:
                    document.terms_and_conditions,
                reference_number:
                    document.reference_number,
                source_document_id:
                    document.source_document_id,

                items: items.results,
                snapshot: parsedSnapshot,

                created_by:
                    document.created_by,
                created_at:
                    document.created_at,
                updated_at:
                    document.updated_at,
            },
        });
    }
}