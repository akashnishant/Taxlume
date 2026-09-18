export type CompanySnapshot = {
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

export type PartyAddressSnapshot = {
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

export type PartySnapshot = {
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
    addresses: PartyAddressSnapshot[];
};

export type PaymentSnapshot = {
    bank_name: string | null;
    account_holder_name: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    branch_name: string | null;
    upi_id: string | null;
    show_qr_on_invoice: boolean;
};

export async function copyDocumentAsset(
    bucket: R2Bucket,
    sourceKey: string | null,
    documentId: string,
    assetName: "signature" | "payment-qr",
): Promise<string | null> {
    if (!sourceKey) {
        return null;
    }

    const sourceObject =
        await bucket.get(sourceKey);

    if (!sourceObject) {
        throw new Error(
            `Configured ${assetName} asset could not be found in storage.`,
        );
    }

    const extension =
        sourceKey.includes(".")
            ? sourceKey.split(".").pop()
            : undefined;

    const destinationKey =
        `document-files/${documentId}/${assetName}/${crypto.randomUUID()}${
            extension ? `.${extension}` : ""
        }`;

    await bucket.put(
        destinationKey,
        sourceObject.body,
        {
            httpMetadata:
                sourceObject.httpMetadata,
            customMetadata: {
                documentId,
                purpose:
                    assetName === "signature"
                        ? "document-signature-snapshot"
                        : "document-payment-qr-snapshot",
                sourceKey,
            },
        },
    );

    return destinationKey;
}