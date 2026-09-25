import {
    projectRecurringExpenses,
    recurringOccurrenceKey,
    type RecurringProjectionRule,
} from "./projectRecurringExpenses";

type ExistingOccurrenceRow = {
    recurring_rule_id: string;
    recurring_occurrence_date: string;
};

type CategoryRow = {
    id: string;
    name: string;
    parent_category_id: string | null;
    parent_category_name: string | null;
};

export type ScheduledExpensePeriod = {
    period: string;
    occurrence_count: number;
    scheduled_paise: number;
};

export type ScheduledExpenseCategory = {
    category_id: string;
    category_name: string;
    parent_category_id: string | null;
    parent_category_name: string | null;
    occurrence_count: number;
    scheduled_paise: number;
};

export type ScheduledExpenseCurrency = {
    currency_code: string;
    occurrence_count: number;
    scheduled_paise: number;
    periods: ScheduledExpensePeriod[];
    categories: ScheduledExpenseCategory[];
};

/**
 * Read-only report of recurring occurrences that have not yet
 * generated an expense. Existing occurrence checks include
 * soft-deleted records, consistent with the actual generator.
 */
export async function loadScheduledExpenseReport(input: {
    db: D1Database;
    companyId: string;
    reportStartDate: string;
    reportEndDate: string;
    asOfDate: string;
    periodLength: 4 | 7 | 10;
}): Promise<ScheduledExpenseCurrency[]> {
    const {
        db,
        companyId,
        reportStartDate,
        reportEndDate,
        asOfDate,
        periodLength,
    } = input;

    const projectionStart =
        reportStartDate > asOfDate
            ? reportStartDate
            : asOfDate;

    if (projectionStart > reportEndDate) {
        return [];
    }

    const [rulesResult, existingResult, categoriesResult] =
        await Promise.all([
            db.prepare(`
                SELECT
                    id,
                    category_id,
                    amount_paise,
                    currency_code,
                    frequency,
                    interval_count,
                    start_date,
                    end_date,
                    next_run_date
                FROM recurring_expense_rules
                WHERE company_id = ?
                  AND is_active = 1
                  AND deleted_at IS NULL
                  AND next_run_date <= ?
                  AND (
                      end_date IS NULL
                      OR end_date >= ?
                  )
                ORDER BY next_run_date, id
            `)
                .bind(
                    companyId,
                    reportEndDate,
                    projectionStart,
                )
                .all<RecurringProjectionRule>(),

            db.prepare(`
                SELECT
                    recurring_rule_id,
                    recurring_occurrence_date
                FROM expenses
                WHERE company_id = ?
                  AND recurring_rule_id IS NOT NULL
                  AND recurring_occurrence_date >= ?
                  AND recurring_occurrence_date <= ?
            `)
                .bind(
                    companyId,
                    projectionStart,
                    reportEndDate,
                )
                .all<ExistingOccurrenceRow>(),

            db.prepare(`
                SELECT
                    category.id,
                    category.name,
                    category.parent_category_id,
                    parent.name AS parent_category_name
                FROM expense_categories AS category
                LEFT JOIN expense_categories AS parent
                  ON parent.id = category.parent_category_id
                 AND parent.company_id = category.company_id
                WHERE category.company_id = ?
            `)
                .bind(companyId)
                .all<CategoryRow>(),
        ]);

    const existingOccurrenceKeys = new Set(
        existingResult.results.map((existing) =>
            recurringOccurrenceKey(
                existing.recurring_rule_id,
                existing.recurring_occurrence_date,
            ),
        ),
    );

    const occurrences = projectRecurringExpenses({
        rules: rulesResult.results,
        reportStartDate,
        reportEndDate,
        asOfDate,
        existingOccurrenceKeys,
    });

    const categoryById = new Map(
        categoriesResult.results.map((category) => [
            category.id,
            category,
        ]),
    );

    const currencyByCode =
        new Map<string, ScheduledExpenseCurrency>();

    for (const occurrence of occurrences) {
        let currency = currencyByCode.get(
            occurrence.currency_code,
        );

        if (!currency) {
            currency = {
                currency_code: occurrence.currency_code,
                occurrence_count: 0,
                scheduled_paise: 0,
                periods: [],
                categories: [],
            };

            currencyByCode.set(
                occurrence.currency_code,
                currency,
            );
        }

        currency.occurrence_count += 1;
        currency.scheduled_paise += occurrence.amount_paise;

        const periodKey = occurrence.occurrence_date.slice(
            0,
            periodLength,
        );

        let period = currency.periods.find(
            (item) => item.period === periodKey,
        );

        if (!period) {
            period = {
                period: periodKey,
                occurrence_count: 0,
                scheduled_paise: 0,
            };

            currency.periods.push(period);
        }

        period.occurrence_count += 1;
        period.scheduled_paise += occurrence.amount_paise;

        const categoryInfo = categoryById.get(
            occurrence.category_id,
        );

        if (!categoryInfo) {
            throw new Error(
                `Category missing for recurring rule ${occurrence.rule_id}`,
            );
        }

        let category = currency.categories.find(
            (item) =>
                item.category_id === occurrence.category_id,
        );

        if (!category) {
            category = {
                category_id: categoryInfo.id,
                category_name: categoryInfo.name,
                parent_category_id:
                    categoryInfo.parent_category_id,
                parent_category_name:
                    categoryInfo.parent_category_name,
                occurrence_count: 0,
                scheduled_paise: 0,
            };

            currency.categories.push(category);
        }

        category.occurrence_count += 1;
        category.scheduled_paise += occurrence.amount_paise;
    }

    const currencies = [...currencyByCode.values()];

    for (const currency of currencies) {
        currency.periods.sort((a, b) =>
            a.period.localeCompare(b.period),
        );

        currency.categories.sort(
            (a, b) =>
                b.scheduled_paise - a.scheduled_paise ||
                a.category_name.localeCompare(b.category_name),
        );
    }

    return currencies.sort((a, b) =>
        a.currency_code.localeCompare(b.currency_code),
    );
}