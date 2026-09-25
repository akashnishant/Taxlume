export type RecurringFrequency =
    | "DAILY"
    | "WEEKLY"
    | "MONTHLY"
    | "YEARLY";

const MS_PER_DAY =
    24 * 60 * 60 * 1000;

function parseDateOnly(
    value: string,
): Date {
    const year =
        Number(
            value.slice(0, 4),
        );

    const month =
        Number(
            value.slice(5, 7),
        );

    const day =
        Number(
            value.slice(8, 10),
        );

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
        ),
    );
}

function formatDateOnly(
    value: Date,
): string {
    return value
        .toISOString()
        .slice(0, 10);
}

function daysInMonth(
    year: number,
    monthIndex: number,
): number {
    return new Date(
        Date.UTC(
            year,
            monthIndex + 1,
            0,
        ),
    ).getUTCDate();
}

function addDays(
    startDate: string,
    days: number,
): string {
    const start =
        parseDateOnly(startDate);

    start.setUTCDate(
        start.getUTCDate() +
            days,
    );

    return formatDateOnly(start);
}

/*
 * Calculate a monthly occurrence from the original
 * start-date anchor.
 *
 * Example:
 * Jan 31 + 1 month => Feb 28
 * Jan 31 + 2 months => Mar 31
 *
 * This avoids cumulative month-end drift.
 */
function addMonthsFromAnchor(
    startDate: string,
    monthOffset: number,
): string {
    const start =
        parseDateOnly(startDate);

    const anchorDay =
        start.getUTCDate();

    const absoluteMonth =
        start.getUTCFullYear() *
            12 +
        start.getUTCMonth() +
        monthOffset;

    const year =
        Math.floor(
            absoluteMonth / 12,
        );

    const month =
        absoluteMonth % 12;

    const day =
        Math.min(
            anchorDay,
            daysInMonth(
                year,
                month,
            ),
        );

    return formatDateOnly(
        new Date(
            Date.UTC(
                year,
                month,
                day,
            ),
        ),
    );
}

function addYearsFromAnchor(
    startDate: string,
    yearOffset: number,
): string {
    const start =
        parseDateOnly(startDate);

    const year =
        start.getUTCFullYear() +
        yearOffset;

    const month =
        start.getUTCMonth();

    const day =
        Math.min(
            start.getUTCDate(),
            daysInMonth(
                year,
                month,
            ),
        );

    return formatDateOnly(
        new Date(
            Date.UTC(
                year,
                month,
                day,
            ),
        ),
    );
}

/*
 * Return the first scheduled occurrence strictly
 * after afterDate while retaining startDate as the
 * recurrence anchor.
 */
export function getNextRecurringDateAfter(
    input: {
        startDate: string;
        afterDate: string;
        frequency:
            RecurringFrequency;
        intervalCount: number;
    },
): string {
    const {
        startDate,
        afterDate,
        frequency,
        intervalCount,
    } =
        input;

    if (intervalCount < 1) {
        throw new Error(
            "Recurring interval must be positive",
        );
    }

    if (afterDate < startDate) {
        return startDate;
    }

    const start =
        parseDateOnly(
            startDate,
        );

    const after =
        parseDateOnly(
            afterDate,
        );

    if (
        frequency === "DAILY" ||
        frequency === "WEEKLY"
    ) {
        const stepDays =
            frequency === "DAILY"
                ? intervalCount
                : intervalCount * 7;

        const differenceDays =
            Math.floor(
                (
                    after.getTime() -
                    start.getTime()
                ) /
                    MS_PER_DAY,
            );

        const occurrenceIndex =
            Math.floor(
                differenceDays /
                    stepDays,
            ) + 1;

        return addDays(
            startDate,
            occurrenceIndex *
                stepDays,
        );
    }

    if (
        frequency ===
        "MONTHLY"
    ) {
        const monthDifference =
            (
                after.getUTCFullYear() -
                start.getUTCFullYear()
            ) *
                12 +
            (
                after.getUTCMonth() -
                start.getUTCMonth()
            );

        let occurrenceIndex =
            Math.max(
                0,
                Math.floor(
                    monthDifference /
                        intervalCount,
                ),
            );

        let candidate =
            addMonthsFromAnchor(
                startDate,
                occurrenceIndex *
                    intervalCount,
            );

        while (
            candidate <= afterDate
        ) {
            occurrenceIndex += 1;

            candidate =
                addMonthsFromAnchor(
                    startDate,
                    occurrenceIndex *
                        intervalCount,
                );
        }

        return candidate;
    }

    const yearDifference =
        after.getUTCFullYear() -
        start.getUTCFullYear();

    let occurrenceIndex =
        Math.max(
            0,
            Math.floor(
                yearDifference /
                    intervalCount,
            ),
        );

    let candidate =
        addYearsFromAnchor(
            startDate,
            occurrenceIndex *
                intervalCount,
        );

    while (
        candidate <= afterDate
    ) {
        occurrenceIndex += 1;

        candidate =
            addYearsFromAnchor(
                startDate,
                occurrenceIndex *
                    intervalCount,
            );
    }

    return candidate;
}
