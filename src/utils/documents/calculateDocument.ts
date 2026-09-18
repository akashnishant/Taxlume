export type DocumentCalculationItemInput = {
    quantity_milli: number;
    rate_paise: number;
    discount_paise: number;
    gst_rate_bps: number;
    cess_rate_bps: number;
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
    totalPaise: number;
};

export function calculateDocument(
    items: DocumentCalculationItemInput[],
    isIntraState: boolean,
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

            const totalGstPaise = Math.floor(
                (taxableAmountPaise *
                    item.gst_rate_bps) /
                10000,
            );

            const cessPaise = Math.floor(
                (taxableAmountPaise *
                    item.cess_rate_bps) /
                10000,
            );

            let cgstPaise = 0;
            let sgstPaise = 0;
            let igstPaise = 0;

            let cgstRateBps = 0;
            let sgstRateBps = 0;
            let igstRateBps = 0;

            if (
                isIntraState &&
                item.gst_rate_bps > 0
            ) {
                cgstRateBps =
                    Math.floor(
                        item.gst_rate_bps / 2,
                    );

                sgstRateBps =
                    item.gst_rate_bps -
                    cgstRateBps;

                cgstPaise =
                    Math.floor(
                        (totalGstPaise *
                            cgstRateBps) /
                        item.gst_rate_bps,
                    );

                sgstPaise =
                    totalGstPaise -
                    cgstPaise;
            } else if (
                item.gst_rate_bps > 0
            ) {
                igstRateBps =
                    item.gst_rate_bps;

                igstPaise =
                    totalGstPaise;
            }

            const totalPaise =
                taxableAmountPaise +
                totalGstPaise +
                cessPaise;

            return {
                lineNumber: index + 1,
                grossPaise,
                discountPaise,
                taxableAmountPaise,
                totalGstPaise,
                gstRateBps:
                    item.gst_rate_bps,
                cessRateBps:
                    item.cess_rate_bps,
                cgstRateBps,
                sgstRateBps,
                igstRateBps,
                cgstPaise,
                sgstPaise,
                igstPaise,
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

    const taxableAmountPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.taxableAmountPaise,
            0,
        );

    const cgstPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.cgstPaise,
            0,
        );

    const sgstPaise =
        calculatedItems.reduce(
            (sum, item) =>
                sum + item.sgstPaise,
            0,
        );

    const igstPaise =
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

    const totalPaise =
        taxableAmountPaise +
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
        totalPaise,
    };
}