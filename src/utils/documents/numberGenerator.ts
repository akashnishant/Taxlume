type DocumentNumberResult = {
    documentNumber: string;
    financialYear: string;
};

export function getFinancialYear(date: Date): string {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;

    if (month >= 4) {
        return `${year}-${String(year + 1).slice(-2)}`;
    }

    return `${year - 1}-${String(year).slice(-2)}`;
}

export function getDefaultPrefix(documentType: string): string {
    switch (documentType) {
        case "TAX_INVOICE":
            return "INV";

        case "PROFORMA_INVOICE":
            return "PI";

        case "PURCHASE_ORDER":
            return "PO";

        case "QUOTATION":
            return "QT";

        case "DELIVERY_CHALLAN":
            return "DC";

        default:
            return documentType;
    }
}

export async function generateDocumentNumber(
    db: D1Database,
    companyId: string,
    documentType: string,
    date: Date = new Date(),
): Promise<DocumentNumberResult> {
    const financialYear = getFinancialYear(date);
    const now = new Date().toISOString();

    const defaultPrefix =
        getDefaultPrefix(documentType);

    const sequence = await db
        .prepare(`
			INSERT INTO document_number_sequences (
				id,
				company_id,
				document_type,
				financial_year,
				prefix,
				suffix,
				next_number,
				padding,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, '', 2, 4, ?, ?)

			ON CONFLICT (
				company_id,
				document_type,
				financial_year
			)
			DO UPDATE SET
				next_number =
					document_number_sequences.next_number + 1,
				updated_at = excluded.updated_at

			RETURNING
				prefix,
				suffix,
				next_number,
				padding
		`)
        .bind(
            crypto.randomUUID(),
            companyId,
            documentType,
            financialYear,
            defaultPrefix,
            now,
            now,
        )
        .first<{
            prefix: string | null;
            suffix: string | null;
            next_number: number;
            padding: number;
        }>();

    if (!sequence) {
        throw new Error(
            "Failed to allocate document number",
        );
    }

    // The stored next_number has already been incremented.
    // Therefore the number allocated to this request is one less.
    const allocatedNumber =
        sequence.next_number - 1;

    const prefix = sequence.prefix ?? "";
    const suffix = sequence.suffix ?? "";

    const numberPart = String(
        allocatedNumber,
    ).padStart(sequence.padding, "0");

    const documentNumber =
        `${prefix}-${financialYear}-${numberPart}${suffix}`;

    return {
        documentNumber,
        financialYear,
    };
}