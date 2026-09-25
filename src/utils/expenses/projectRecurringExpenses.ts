import {
    getNextRecurringDateAfter,
    type RecurringFrequency,
} from "./recurringSchedule";

export type RecurringProjectionRule = {
    id: string;
    category_id: string;
    amount_paise: number;
    currency_code: string;
    frequency: RecurringFrequency;
    interval_count: number;
    start_date: string;
    end_date: string | null;
    next_run_date: string;
};

export type ProjectedRecurringOccurrence = {
    rule_id: string;
    category_id: string;
    currency_code: string;
    occurrence_date: string;
    amount_paise: number;
};

type ProjectionInput = {
    rules: RecurringProjectionRule[];
    reportStartDate: string;
    reportEndDate: string;
    asOfDate: string;
    existingOccurrenceKeys: ReadonlySet<string>;
};

const MAX_PROJECTED_OCCURRENCES = 20_000;

/**
 * Use this key for both existing expense records and projected
 * occurrences. A rule can produce at most one expense per
 * scheduled occurrence date.
 */
export function recurringOccurrenceKey(
    ruleId: string,
    occurrenceDate: string,
): string {
    return `${ruleId}\u0000${occurrenceDate}`;
}

function previousCalendarDate(value: string): string {
    const date = new Date(`${value}T00:00:00.000Z`);

    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
}

function laterDate(...dates: string[]): string {
    return dates.reduce(
        (latest, date) => date > latest ? date : latest,
    );
}

/**
 * Calculate not-yet-generated recurring occurrences.
 *
 * The caller must supply active, non-deleted rules for the
 * authenticated company and existing occurrence keys from
 * that same company, including soft-deleted expense records.
 *
 * This function is read-only. It neither generates expenses
 * nor advances a recurring rule's next_run_date.
 */
export function projectRecurringExpenses({
    rules,
    reportStartDate,
    reportEndDate,
    asOfDate,
    existingOccurrenceKeys,
}: ProjectionInput): ProjectedRecurringOccurrence[] {
    const projections: ProjectedRecurringOccurrence[] = [];

    // Overdue, ungenerated occurrences are not future projections.
    // An ungenerated occurrence due today can still be projected.
    const projectionStart = laterDate(
        reportStartDate,
        asOfDate,
    );

    if (projectionStart > reportEndDate) {
        return projections;
    }

    for (const rule of rules) {
        const firstEligibleDate = laterDate(
            projectionStart,
            rule.start_date,
            rule.next_run_date,
        );

        const lastEligibleDate =
            rule.end_date && rule.end_date < reportEndDate
                ? rule.end_date
                : reportEndDate;

        if (firstEligibleDate > lastEligibleDate) {
            continue;
        }

        let occurrenceDate = rule.next_run_date;

        if (occurrenceDate < firstEligibleDate) {
            occurrenceDate = getNextRecurringDateAfter({
                startDate: rule.start_date,
                afterDate: previousCalendarDate(
                    firstEligibleDate,
                ),
                frequency: rule.frequency,
                intervalCount: rule.interval_count,
            });
        }

        while (occurrenceDate <= lastEligibleDate) {
            const key = recurringOccurrenceKey(
                rule.id,
                occurrenceDate,
            );

            if (!existingOccurrenceKeys.has(key)) {
                if (
                    projections.length >=
                    MAX_PROJECTED_OCCURRENCES
                ) {
                    throw new Error(
                        "Scheduled expense projection exceeds " +
                        "20,000 occurrences. Select a shorter " +
                        "date range.",
                    );
                }

                projections.push({
                    rule_id: rule.id,
                    category_id: rule.category_id,
                    currency_code: rule.currency_code,
                    occurrence_date: occurrenceDate,
                    amount_paise: rule.amount_paise,
                });
            }

            const nextDate = getNextRecurringDateAfter({
                startDate: rule.start_date,
                afterDate: occurrenceDate,
                frequency: rule.frequency,
                intervalCount: rule.interval_count,
            });

            // Defensive guard against malformed recurrence data.
            if (nextDate <= occurrenceDate) {
                throw new Error(
                    `Recurring rule ${rule.id} did not advance`,
                );
            }

            occurrenceDate = nextDate;
        }
    }

    return projections;
}