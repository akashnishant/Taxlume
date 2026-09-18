export type DocumentValidationInput = {
    documentType: string;
    status: string;
    partyId: string | null;

    company: {
        legalName: string | null;
        gstin: string | null;
        state: string | null;
        stateCode: string | null;
        addressLine1: string | null;
        city: string | null;
        pincode: string | null;
    };

    party: {
        displayName: string | null;
        gstin: string | null;
        role: string | null;
        addresses: Array<{
            address_type: string;
            address_line1: string;
            city: string | null;
            state: string | null;
            state_code: string | null;
            pincode: string | null;
            is_default: number;
        }>;
    } | null;

    totalPaise: number;
    itemCount: number;
};

export type DocumentValidationResult = {
    valid: boolean;
    errors: string[];
};

export function validateDocumentForIssuance(
    input: DocumentValidationInput,
): DocumentValidationResult {
    const errors: string[] = [];

    if (input.status !== "DRAFT") {
        errors.push(
            `Only DRAFT documents can be issued. Current status: ${input.status}`,
        );
    }

    if (!input.company.legalName?.trim()) {
        errors.push("Company legal name is required.");
    }

    if (!input.company.addressLine1?.trim()) {
        errors.push("Company address is required.");
    }

    if (!input.company.city?.trim()) {
        errors.push("Company city is required.");
    }

    if (!input.company.state?.trim()) {
        errors.push("Company state is required.");
    }

    if (!input.company.pincode?.trim()) {
        errors.push("Company pincode is required.");
    }

    if (!input.partyId) {
        errors.push("A customer or vendor must be selected.");
    }

    if (!input.party) {
        errors.push("The selected party could not be found.");
    }

    if (input.party) {
        const expectedPartyRole =
            input.documentType === "PURCHASE_ORDER"
                ? "VENDOR"
                : "CUSTOMER";

        if (input.party.role !== expectedPartyRole) {
            errors.push(
                `Selected party must have the ${expectedPartyRole.toLowerCase()} role for ${input.documentType}.`,
            );
        }
        if (!input.party.displayName?.trim()) {
            errors.push("Party name is required.");
        }

        if (input.party.addresses.length === 0) {
            errors.push("Party address is required.");
        } else {
            const hasUsableAddress =
                input.party.addresses.some(
                    (address) =>
                        address.address_line1.trim() &&
                        address.city?.trim() &&
                        address.state?.trim() &&
                        address.pincode?.trim(),
                );

            if (!hasUsableAddress) {
                errors.push(
                    "Party must have at least one complete address.",
                );
            }
        }
    }

    if (input.itemCount <= 0) {
        errors.push("At least one item is required.");
    }

    if (input.totalPaise <= 0) {
        errors.push("Document total must be greater than zero.");
    }

    if (input.documentType === "TAX_INVOICE") {
        if (!input.company.gstin?.trim()) {
            errors.push(
                "Company GSTIN is required before issuing a Tax Invoice.",
            );
        }

        if (!input.party?.gstin?.trim()) {
            errors.push(
                "Customer GSTIN is required before issuing a Tax Invoice.",
            );
        }

        if (!input.company.stateCode?.trim()) {
            errors.push(
                "Company state code is required before issuing a Tax Invoice.",
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}