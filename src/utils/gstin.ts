const GSTIN_FORMAT =
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(
    gstin: string,
): string {
    return gstin.trim().toUpperCase();
}

export function isValidGstinFormat(
    gstin: string,
): boolean {
    return GSTIN_FORMAT.test(
        normalizeGstin(gstin),
    );
}

export function doesGstinMatchStateCode(
    gstin: string,
    stateCode: string,
): boolean {
    const normalizedGstin =
        normalizeGstin(gstin);

    const normalizedStateCode =
        stateCode.trim();

    return (
        normalizedGstin.slice(0, 2) ===
        normalizedStateCode
    );
}