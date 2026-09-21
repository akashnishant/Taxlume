export type DocumentCalculationItemInput = {
    quantity_milli: number;
    rate_paise: number;
    discount_paise: number;
    gst_rate_bps: number;
    cess_rate_bps: number;
};

export type DocumentAdditionalChargeInput = {
    amount_paise: number;
    taxable: boolean;
    gst_rate_bps: number;
};

export type CalculatedDocumentItem = {
    lineNumber: number;
    grossPaise: number;
    discountPaise: number;
    taxableAmountPaise: number;
    totalGstPaise: number;
    gstRateBps: number;
    cessRateBps: number;
    cgstRateBps: number;
    sgstRateBps: number;
    igstRateBps: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalPaise: number;
};

export type DocumentCalculationResult = {
    items: CalculatedDocumentItem[];

    subtotalPaise: number;
    discountPaise: number;
    taxableAmountPaise: number;

    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;

    additionalChargePaise: number;
    additionalChargeTaxablePaise: number;
    additionalChargeGstRateBps: number;
    additionalChargeCgstPaise: number;
    additionalChargeSgstPaise: number;
    additionalChargeIgstPaise: number;
    additionalChargeTaxPaise: number;

    totalPaise: number;
};

type GstBreakdown = {
    totalGstPaise: number;
    cgstRateBps: number;
    sgstRateBps: number;
    igstRateBps: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
};

function calculateGst(
    taxableAmountPaise: number,
    gstRateBps: number,
    isIntraState: boolean,
): GstBreakdown {
    const safeTaxableAmountPaise = Math.max(
        0,
        Math.floor(taxableAmountPaise),
    );

    const safeGstRateBps = Math.min(
        10000,
        Math.max(0, Math.floor(gstRateBps)),
    );

    const totalGstPaise = Math.floor(
        (safeTaxableAmountPaise * safeGstRateBps) /
            10000,
    );

    let cgstRateBps = 0;
    let sgstRateBps = 0;
    let igstRateBps = 0;

    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;

    if (isIntraState && safeGstRateBps > 0) {
        cgstRateBps = Math.floor(
            safeGstRateBps / 2,
        );

        sgstRateBps =
            safeGstRateBps - cgstRateBps;

        cgstPaise = Math.floor(
            (totalGstPaise * cgstRateBps) /
                safeGstRateBps,
        );

        sgstPaise =
            totalGstPaise - cgstPaise;
    } else if (safeGstRateBps > 0) {
        igstRateBps = safeGstRateBps;
        igstPaise = totalGstPaise;
    }

    return {
        totalGstPaise,
        cgstRateBps,
        sgstRateBps,
        igstRateBps,
        cgstPaise,
        sgstPaise,
        igstPaise,
    };
}

export function calculateDocument(
    items: DocumentCalculationItemInput[],
    isIntraState: boolean,
    additionalCharge?: DocumentAdditionalChargeInput,
): DocumentCalculationResult {
    const calculatedItems = items.map(
        (item, index) => {
            const quantity =
                item.quantity_milli;

            const rate =
                item.rate_paise;

            const grossPaise = Math.floor(
                (quantity * rate) / 1000,
            );

            const discountPaise = Math.min(
                Math.max(0, item.discount_paise),
                grossPaise,
            );

            const taxableAmountPaise =
                grossPaise - discountPaise;

            const gst = calculateGst(
                taxableAmountPaise,
                item.gst_rate_bps,
                isIntraState,
            );

            const cessPaise = Math.floor(
                (taxableAmountPaise *
                    item.cess_rate_bps) /
                    10000,
            );

            const totalPaise =
                taxableAmountPaise +
                gst.totalGstPaise +
                cessPaise;

            return {
                lineNumber: index + 1,
                grossPaise,
                discountPaise,
                taxableAmountPaise,
                totalGstPaise:
                    gst.totalGstPaise,
                gstRateBps:
                    item.gst_rate_bps,
                cessRateBps:
                    item.cess_rate_bps,
                cgstRateBps:
                    gst.cgstRateBps,
                sgstRateBps:
                    gst.sgstRateBps,
                igstRateBps:
                    gst.igstRateBps,
                cgstPaise:
                    gst.cgstPaise,
                sgstPaise:
                    gst.sgstPaise,
                igstPaise:
                    gst.igstPaise,
                cessPaise,
                totalPaise,
            };
        },
    );

    const subtotalPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.grossPaise,
            0,
        );

    const discountPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.discountPaise,
            0,
        );

    const itemTaxableAmountPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.taxableAmountPaise,
            0,
        );

    const itemCgstPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.cgstPaise,
            0,
        );

    const itemSgstPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.sgstPaise,
            0,
        );

    const itemIgstPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.igstPaise,
            0,
        );

    const cessPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.cessPaise,
            0,
        );

    const additionalChargePaise =
        Math.max(
            0,
            Math.floor(
                additionalCharge?.amount_paise ?? 0,
            ),
        );

    const additionalChargeTaxable =
        Boolean(
            additionalCharge?.taxable &&
            additionalChargePaise > 0,
        );

    const additionalChargeGstRateBps =
        additionalChargeTaxable
            ? Math.min(
                10000,
                Math.max(
                    0,
                    Math.floor(
                        additionalCharge?.gst_rate_bps ??
                            0,
                    ),
                ),
            )
            : 0;

    const additionalChargeTaxablePaise =
        additionalChargeTaxable
            ? additionalChargePaise
            : 0;

    const additionalChargeGst =
        calculateGst(
            additionalChargeTaxablePaise,
            additionalChargeGstRateBps,
            isIntraState,
        );

    const taxableAmountPaise =
        itemTaxableAmountPaise +
        additionalChargeTaxablePaise;

    const cgstPaise =
        itemCgstPaise +
        additionalChargeGst.cgstPaise;

    const sgstPaise =
        itemSgstPaise +
        additionalChargeGst.sgstPaise;

    const igstPaise =
        itemIgstPaise +
        additionalChargeGst.igstPaise;

    const additionalChargeTaxPaise =
        additionalChargeGst.cgstPaise +
        additionalChargeGst.sgstPaise +
        additionalChargeGst.igstPaise;

    /*
     * Additional charge is added exactly once.
     *
     * If taxable:
     *   item taxable value
     *   + charge
     *   + tax on items
     *   + tax on charge
     *
     * If non-taxable:
     *   item taxable value
     *   + charge
     *   + tax on items
     */
    const totalPaise =
        itemTaxableAmountPaise +
        additionalChargePaise +
        cgstPaise +
        sgstPaise +
        igstPaise +
        cessPaise;

    return {
        items: calculatedItems,

        subtotalPaise,
        discountPaise,
        taxableAmountPaise,

        cgstPaise,
        sgstPaise,
        igstPaise,
        cessPaise,

        additionalChargePaise,
        additionalChargeTaxablePaise,
        additionalChargeGstRateBps,

        additionalChargeCgstPaise:
            additionalChargeGst.cgstPaise,

        additionalChargeSgstPaise:
            additionalChargeGst.sgstPaise,

        additionalChargeIgstPaise:
            additionalChargeGst.igstPaise,

        additionalChargeTaxPaise,

        totalPaise,
    };
}
