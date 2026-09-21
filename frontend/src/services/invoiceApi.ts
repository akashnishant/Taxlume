import api from "./api";

export type Invoice = {
    id: string;
    document_number: string;
    document_type: string;
    status: string;
    document_date: string;
    total_paise: number;
};

export type CreateDocumentItemRequest = {
    product_id?: string;
    item_name: string;
    description?: string;
    hsn_sac?: string;
    unit: string;
    quantity_milli: number;
    rate_paise: number;
    discount_paise: number;
    gst_rate_bps?: number;
    cess_rate_bps?: number;
};

export type PaymentTermsCode =
    | "DUE_ON_RECEIPT"
    | "NET_7"
    | "NET_15"
    | "NET_30"
    | "NET_45"
    | "NET_60"
    | "CUSTOM";

export type CreateDocumentRequest = {
    document_type:
        | "TAX_INVOICE"
        | "PROFORMA_INVOICE"
        | "PURCHASE_ORDER"
        | "QUOTATION"
        | "DELIVERY_CHALLAN";
    document_date: string;
    due_date?: string;
    party_id?: string;
    place_of_supply_state?: string;
    place_of_supply_state_code?: string;
    supply_type?: string;
    currency_code?: string;
    notes?: string;
    terms_and_conditions?: string;
    reference_number?: string;

    payment_terms_code?: PaymentTermsCode;
    payment_terms_custom?: string;
    customer_po_number?: string;

    ship_to_same_as_bill_to?: boolean;
    ship_to_name?: string;
    ship_to_contact_person?: string;
    ship_to_gstin?: string;
    ship_to_phone?: string;
    ship_to_email?: string;
    ship_to_address_line1?: string;
    ship_to_address_line2?: string;
    ship_to_city?: string;
    ship_to_state?: string;
    ship_to_state_code?: string;
    ship_to_pincode?: string;
    ship_to_country?: string;

    additional_charge_label?: string;
    additional_charge_paise?: number;
    additional_charge_taxable?: boolean;
    additional_charge_gst_rate_bps?: number;

    items: CreateDocumentItemRequest[];
};

export type CreateDocumentResponse = {
    id: string;
    document_type: string;
    document_number: string;
    document_date: string;
    status: string;
    total_paise: number;
};

export type InvoicePartyAddress = {
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

export type InvoiceParty = {
    id: string;
    display_name: string | null;
    legal_name: string | null;
    gstin: string | null;
    pan: string | null;
    email: string | null;
    phone: string | null;
    addresses: InvoicePartyAddress[];
};

export type InvoiceCompanySnapshot = {
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
};

export type InvoicePartyAddressSnapshot = {
    address_type: string;
    label: string | null;
    address_line1: string;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    state_code: string | null;
    pincode: string | null;
    country: string;
    is_default: boolean;
};

export type InvoicePartySnapshot = {
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
    addresses: InvoicePartyAddressSnapshot[];
};

export type InvoicePaymentSnapshot = {
    bank_name: string | null;
    account_holder_name: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    branch_name: string | null;
    upi_id: string | null;
    show_qr_on_invoice: boolean;
};

export type InvoiceSnapshot = {
    snapshot_version: number;
    company: InvoiceCompanySnapshot;
    party: InvoicePartySnapshot | null;
    payment: InvoicePaymentSnapshot | null;
    has_signature: boolean;
    has_payment_qr: boolean;
    issued_by: string | null;
    issued_at: string;
};

export type InvoiceItem = {
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

export type InvoiceDetails = {
    id: string;
    document_type: string;
    document_number: string;
    document_date: string;
    due_date: string | null;
    status: string;
    currency_code: string;

    party: InvoiceParty | null;

    place_of_supply: {
        state: string | null;
        state_code: string | null;
    };

    supply_type: string | null;

    payment_terms: {
        code: PaymentTermsCode | null;
        custom: string | null;
    };

    customer_po_number: string | null;

    ship_to: {
        same_as_bill_to: boolean | null;
        name: string | null;
        contact_person: string | null;
        gstin: string | null;
        phone: string | null;
        email: string | null;
        address_line1: string | null;
        address_line2: string | null;
        city: string | null;
        state: string | null;
        state_code: string | null;
        pincode: string | null;
        country: string | null;
    };

    additional_charge: {
        label: string | null;
        amount_paise: number;
        taxable: boolean;
        gst_rate_bps: number;
        cgst_paise: number;
        sgst_paise: number;
        igst_paise: number;
        tax_paise: number;
    };

    totals: {
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
    };

    notes: string | null;
    terms_and_conditions: string | null;
    reference_number: string | null;
    source_document_id: string | null;

    items: InvoiceItem[];
    snapshot: InvoiceSnapshot | null;

    created_by: string | null;
    created_at: string;
    updated_at: string;
};

export type UpdateDocumentItemRequest = {
    product_id?: string | null;
    item_name: string;
    description?: string;
    hsn_sac?: string;
    unit: string;
    quantity_milli: number;
    rate_paise: number;
    discount_paise: number;
    gst_rate_bps?: number;
    cess_rate_bps?: number;
};

export type UpdateDocumentRequest = {
    document_date?: string;
    due_date?: string | null;
    party_id?: string | null;
    place_of_supply_state?: string | null;
    place_of_supply_state_code?: string | null;
    supply_type?: string | null;
    currency_code?: string;
    notes?: string | null;
    terms_and_conditions?: string | null;
    reference_number?: string | null;

    payment_terms_code?: PaymentTermsCode | null;
    payment_terms_custom?: string | null;
    customer_po_number?: string | null;

    ship_to_same_as_bill_to?: boolean | null;
    ship_to_name?: string | null;
    ship_to_contact_person?: string | null;
    ship_to_gstin?: string | null;
    ship_to_phone?: string | null;
    ship_to_email?: string | null;
    ship_to_address_line1?: string | null;
    ship_to_address_line2?: string | null;
    ship_to_city?: string | null;
    ship_to_state?: string | null;
    ship_to_state_code?: string | null;
    ship_to_pincode?: string | null;
    ship_to_country?: string | null;

    additional_charge_label?: string | null;
    additional_charge_paise?: number;
    additional_charge_taxable?: boolean;
    additional_charge_gst_rate_bps?: number;

    items?: UpdateDocumentItemRequest[];
};

export type UpdateDocumentResponse = {
    id: string;
    document_type: string;
    document_number: string;
    document_date: string;
    status: string;
    updated_at: string;
};

export type DocumentStatus =
    | "ISSUED"
    | "CANCELLED";

export type UpdateDocumentStatusResponse = {
    id: string;
    document_number: string;
    previous_status: string;
    status: string;
    updated_by: string;
    updated_at: string;
};

export async function getInvoices(): Promise<{
    documents: Invoice[];
    total: number;
}> {
    const response = await api.get<{
        success: boolean;
        documents: Invoice[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            total_pages: number;
        };
    }>("/api/documents");

    return {
        documents: response.data.documents,
        total: response.data.pagination.total,
    };
}

export async function getInvoice(
    id: string,
): Promise<InvoiceDetails> {
    const response = await api.get<{
        success: boolean;
        document: InvoiceDetails;
    }>(`/api/documents/${id}`);

    return response.data.document;
}

export async function createDocument(
    data: CreateDocumentRequest,
): Promise<CreateDocumentResponse> {
    const response = await api.post<{
        success: boolean;
        document: CreateDocumentResponse;
    }>("/api/documents", data);

    return response.data.document;
}

export async function updateDocument(
    id: string,
    data: UpdateDocumentRequest,
): Promise<UpdateDocumentResponse> {
    const response = await api.put<{
        success: boolean;
        message: string;
        document: UpdateDocumentResponse;
    }>(`/api/documents/${id}`, data);

    return response.data.document;
}

export async function updateDocumentStatus(
    id: string,
    status: DocumentStatus,
): Promise<UpdateDocumentStatusResponse> {
    const response = await api.patch<{
        success: boolean;
        document: UpdateDocumentStatusResponse;
    }>(
        `/api/documents/${id}/status`,
        {
            status,
        },
    );

    return response.data.document;
}

export type DocumentSnapshotAsset =
    | "signature"
    | "payment-qr";

export async function getDocumentSnapshotAssetDataUrl(
    documentId: string,
    asset: DocumentSnapshotAsset,
): Promise<string | null> {
    try {
        const response = await api.get<Blob>(
            `/api/documents/${documentId}/snapshot-assets/${asset}`,
            {
                responseType: "blob",
            },
        );

        const blob = response.data;

        return await new Promise<string>(
            (resolve, reject) => {
                const reader = new FileReader();

                reader.onloadend = () => {
                    if (
                        typeof reader.result === "string"
                    ) {
                        resolve(reader.result);
                        return;
                    }

                    reject(
                        new Error(
                            "Unable to read document snapshot asset.",
                        ),
                    );
                };

                reader.onerror = () => {
                    reject(
                        new Error(
                            "Unable to read document snapshot asset.",
                        ),
                    );
                };

                reader.readAsDataURL(blob);
            },
        );
    } catch {
        return null;
    }
}