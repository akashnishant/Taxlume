
import {
    getNextRecurringDateAfter,
    type RecurringFrequency,
} from "./recurringSchedule";

const MAX_RULES_PER_RUN = 100;
const MAX_OCCURRENCES_PER_RUN = 200;

type DueRecurringRule = {
    id: string;
    company_id: string;
    name: string;

    category_id: string;

    vendor_id: string | null;
    payee_name: string | null;
    description: string | null;
    notes: string | null;

    amount_paise: number;
    currency_code: string;
    payment_method: string;

    frequency: RecurringFrequency;
    interval_count: number;

    start_date: string;
    end_date: string | null;

    next_run_date: string;
    last_run_date: string | null;

    is_active: number;

    created_by: string;
    updated_at: string;
};

export type RecurringGenerationResult = {
    scheduled_date: string;
    rules_seen: number;
    occurrences_processed: number;
    expenses_created: number;
    occurrences_reconciled: number;
    rules_completed: number;
    occurrence_limit_reached: boolean;
};

function isRecurringOccurrenceConflict(
    error: unknown,
): boolean {
    const message =
        error instanceof Error
            ? error.message
            : String(error);

    return (
        message.includes(
            "expenses.company_id, expenses.recurring_rule_id, expenses.recurring_occurrence_date",
        ) ||
        message.includes(
            "ux_expenses_recurring_occurrence",
        )
    );
}

async function findExistingOccurrence(
    db: D1Database,
    companyId: string,
    ruleId: string,
    occurrenceDate: string,
) {
    return db
        .prepare(`
            SELECT
                id,
                deleted_at

            FROM expenses

            WHERE company_id = ?
              AND recurring_rule_id = ?
              AND recurring_occurrence_date = ?

            LIMIT 1
        `)
        .bind(
            companyId,
            ruleId,
            occurrenceDate,
        )
        .first<{
            id: string;
            deleted_at: string | null;
        }>();
}

async function advanceRule(
    db: D1Database,
    rule: DueRecurringRule,
    occurrenceDate: string,
    nextRunDate: string,
    completed: boolean,
    now: string,
): Promise<boolean> {
    const result = await db
        .prepare(`
            UPDATE recurring_expense_rules
            SET
                last_run_date = ?,
                next_run_date = ?,
                is_active = ?,
                updated_at = ?
            WHERE id = ?
              AND company_id = ?
              AND deleted_at IS NULL
              AND is_active = 1
              AND next_run_date = ?
              AND updated_at = ?
              AND last_run_date IS ?
        `)
        .bind(
            occurrenceDate,
            nextRunDate,
            completed ? 0 : 1,
            now,
            rule.id,
            rule.company_id,
            occurrenceDate,
            rule.updated_at,
            rule.last_run_date,
        )
        .run();

    return result.success && result.meta.changes === 1;
}

async function deactivateExpiredRule(
    db: D1Database,
    rule: DueRecurringRule,
    expectedNextRunDate: string,
    now: string,
): Promise<boolean> {
    const result = await db
        .prepare(`
            UPDATE recurring_expense_rules
            SET
                is_active = 0,
                updated_at = ?
            WHERE id = ?
              AND company_id = ?
              AND deleted_at IS NULL
              AND is_active = 1
              AND next_run_date = ?
              AND updated_at = ?
              AND last_run_date IS ?
        `)
        .bind(
            now,
            rule.id,
            rule.company_id,
            expectedNextRunDate,
            rule.updated_at,
            rule.last_run_date,
        )
        .run();

    return result.success && result.meta.changes === 1;
}
export async function generateDueRecurringExpenses(
    db: D1Database,
    scheduledAt: Date,
): Promise<RecurringGenerationResult> {
    const now =
        scheduledAt.toISOString();

    const today =
        now.slice(0, 10);

    /*
     * Background generation obeys the same subscription
     * entitlement policy as the authenticated Expenses APIs.
     */
    const dueRules =
        await db
            .prepare(`
                SELECT
                    r.id,
                    r.company_id,
                    r.name,

                    r.category_id,

                    r.vendor_id,
                    r.payee_name,
                    r.description,
                    r.notes,

                    r.amount_paise,
                    r.currency_code,
                    r.payment_method,

                    r.frequency,
                    r.interval_count,

                    r.start_date,
                    r.end_date,

                    r.next_run_date,
                    r.last_run_date,

                    r.is_active,

                    r.created_by,
                    r.updated_at

                FROM recurring_expense_rules AS r

                INNER JOIN companies AS c
                    ON c.id = r.company_id
                   AND c.is_active = 1

                WHERE r.is_active = 1
                  AND r.deleted_at IS NULL
                  AND r.next_run_date <= ?

                  AND EXISTS (
                      SELECT 1

                      FROM company_subscriptions AS cs

                      WHERE cs.company_id = r.company_id
                        AND cs.status = 'ACTIVE'
                        AND cs.current_period_start IS NOT NULL
                        AND cs.current_period_end IS NOT NULL
                        AND cs.current_period_start <= ?
                        AND cs.current_period_end > ?
                  )

                ORDER BY
                    r.next_run_date ASC,
                    r.created_at ASC,
                    r.id ASC

                LIMIT ?
            `)
            .bind(
                today,
                now,
                now,
                MAX_RULES_PER_RUN,
            )
            .all<DueRecurringRule>();

    const summary:
        RecurringGenerationResult = {
            scheduled_date:
                today,

            rules_seen:
                dueRules.results.length,

            occurrences_processed:
                0,

            expenses_created:
                0,

            occurrences_reconciled:
                0,

            rules_completed:
                0,

            occurrence_limit_reached:
                false,
        };

    for (
        const databaseRule of
        dueRules.results
    ) {
        if (
            summary.occurrences_processed >=
            MAX_OCCURRENCES_PER_RUN
        ) {
            summary.occurrence_limit_reached =
                true;

            break;
        }

        const rule: DueRecurringRule = {
            ...databaseRule,
        };

        while (
            rule.is_active === 1 &&
            rule.next_run_date <= today
        ) {
            if (
                summary.occurrences_processed >=
                MAX_OCCURRENCES_PER_RUN
            ) {
                summary.occurrence_limit_reached =
                    true;

                break;
            }

            const occurrenceDate =
                rule.next_run_date;

            /*
             * Defensive recovery for malformed/stale data.
             * Normal API flows should never leave an active
             * rule whose next run is beyond its end date.
             */
            if (
                rule.end_date &&
                occurrenceDate >
                    rule.end_date
            ) {
                const deactivated =
                    await deactivateExpiredRule(
                        db,
                        rule,
                        occurrenceDate,
                        now,
                    );

                if (deactivated) {
                    summary.rules_completed +=
                        1;
                }

                rule.is_active = 0;

                break;
            }

            const nextRunDate =
                getNextRecurringDateAfter({
                    startDate:
                        rule.start_date,

                    afterDate:
                        occurrenceDate,

                    frequency:
                        rule.frequency,

                    intervalCount:
                        rule.interval_count,
                });

            const completed =
                rule.end_date !== null &&
                nextRunDate >
                    rule.end_date;

            /*
             * Look across both active and soft-deleted expenses.
             *
             * A previously generated occurrence must never be
             * regenerated merely because the expense was later
             * soft deleted by a user.
             */
            const existing =
                await findExistingOccurrence(
                    db,
                    rule.company_id,
                    rule.id,
                    occurrenceDate,
                );

            if (existing) {
                const advanced =
                    await advanceRule(
                        db,
                        rule,
                        occurrenceDate,
                        nextRunDate,
                        completed,
                        now,
                    );

                /*
                 * A zero-change update normally means another
                 * invocation advanced this rule concurrently.
                 * Stop processing this stale in-memory copy.
                 */
                if (!advanced) {
                    break;
                }

                summary
                    .occurrences_processed +=
                    1;

                summary
                    .occurrences_reconciled +=
                    1;

                if (completed) {
                    summary.rules_completed +=
                        1;
                }

                rule.last_run_date =
                    occurrenceDate;

                rule.next_run_date =
                    nextRunDate;

                rule.is_active =
                    completed
                        ? 0
                        : 1;

                rule.updated_at = now;

                continue;
            }

            const expenseId =
                crypto.randomUUID();

            const advanceStatement =
                db.prepare(`
                    UPDATE recurring_expense_rules
                    SET
                        last_run_date = ?,
                        next_run_date = ?,
                        is_active = ?,
                        updated_at = ?
                    WHERE id = ?
                      AND company_id = ?
                      AND deleted_at IS NULL
                      AND is_active = 1
                      AND next_run_date = ?
                      AND updated_at = ?
                      AND last_run_date IS ?
                `)
                .bind(
                    occurrenceDate,
                    nextRunDate,
                    completed ? 0 : 1,
                    now,
                    rule.id,
                    rule.company_id,
                    occurrenceDate,
                    rule.updated_at,
                    rule.last_run_date,
                );

            const insertExpense =
                db.prepare(`
                    INSERT INTO expenses (
                        id,
                        company_id,
                        expense_date,
                        category_id,
                        vendor_id,
                        payee_name,
                        description,
                        notes,
                        amount_paise,
                        currency_code,
                        payment_method,
                        source,
                        recurring_rule_id,
                        recurring_occurrence_date,
                        created_by,
                        created_at,
                        updated_at
                    )
                    SELECT
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        'RECURRING',
                        ?, ?, ?, ?, ?
                    WHERE changes() = 1
                `)
                .bind(
                    expenseId,
                    rule.company_id,
                    occurrenceDate,
                    rule.category_id,
                    rule.vendor_id,
                    rule.payee_name,
                    rule.description,
                    rule.notes,
                    rule.amount_paise,
                    rule.currency_code,
                    rule.payment_method,
                    rule.id,
                    occurrenceDate,
                    rule.created_by,
                    now,
                    now,
                );

            const auditMetadata = {
                source: "RECURRING",
                recurring_rule_id: rule.id,
                recurring_occurrence_date:
                    occurrenceDate,
                amount_paise: rule.amount_paise,
                currency_code: rule.currency_code,
                payment_method:
                    rule.payment_method,
            };

            /*
             * No expense inserted means no creation audit.
             * The random expense ID identifies only this
             * invocation's newly created occurrence.
             */
            const auditStatement =
                db.prepare(`
                    INSERT INTO audit_logs (
                        id,
                        company_id,
                        user_id,
                        entity_type,
                        entity_id,
                        action,
                        metadata_json,
                        created_at
                    )
                    SELECT
                        ?, ?, ?,
                        'EXPENSE',
                        ?,
                        'CREATED',
                        ?, ?
                    FROM expenses
                    WHERE id = ?
                      AND company_id = ?
                      AND recurring_rule_id = ?
                      AND recurring_occurrence_date = ?
                `)
                .bind(
                    crypto.randomUUID(),
                    rule.company_id,
                    rule.created_by,
                    expenseId,
                    JSON.stringify(auditMetadata),
                    now,
                    expenseId,
                    rule.company_id,
                    rule.id,
                    occurrenceDate,
                );
            let batchResults;

            try {
                batchResults =
                    await db.batch([
                        advanceStatement,
                        insertExpense,
                        auditStatement,
                    ]);
            } catch (error) {
                /*
                 * The unique recurring-occurrence index is
                 * the final concurrency guard.
                 *
                 * If another invocation inserted the same
                 * occurrence first, reconcile the rule state
                 * instead of creating another expense.
                 */
                if (
                    !isRecurringOccurrenceConflict(
                        error,
                    )
                ) {
                    throw error;
                }

                const racedOccurrence =
                    await findExistingOccurrence(
                        db,
                        rule.company_id,
                        rule.id,
                        occurrenceDate,
                    );

                if (!racedOccurrence) {
                    throw error;
                }

                const advanced =
                    await advanceRule(
                        db,
                        rule,
                        occurrenceDate,
                        nextRunDate,
                        completed,
                        now,
                    );

                if (!advanced) {
                    break;
                }

                summary
                    .occurrences_processed +=
                    1;

                summary
                    .occurrences_reconciled +=
                    1;

                if (completed) {
                    summary.rules_completed +=
                        1;
                }

                rule.last_run_date =
                    occurrenceDate;

                rule.next_run_date =
                    nextRunDate;

                rule.is_active =
                    completed
                        ? 0
                        : 1;

                rule.updated_at = now;

                continue;
            }

            const advanceResult =
                batchResults[0];

            const insertResult =
                batchResults[1];

            const auditResult =
                batchResults[2];

            if (
                !advanceResult?.success ||
                !insertResult?.success ||
                !auditResult?.success
            ) {
                throw new Error(
                    `Recurring expense batch failed for rule ${rule.id} on ${occurrenceDate}`,
                );
            }

            /*
             * Another invocation or an API mutation already
             * changed the rule. This batch must have made
             * no expense or audit changes.
             */
            if (advanceResult.meta.changes === 0) {
                if (
                    insertResult.meta.changes !== 0 ||
                    auditResult.meta.changes !== 0
                ) {
                    throw new Error(
                        "Unclaimed recurring rule produced unexpected database writes",
                    );
                }

                break;
            }

            if (
                advanceResult.meta.changes !== 1 ||
                insertResult.meta.changes !== 1 ||
                auditResult.meta.changes !== 1
            ) {
                throw new Error(
                    `Recurring expense generation failed for rule ${rule.id} on ${occurrenceDate}`,
                );
            }
            summary
                .occurrences_processed +=
                1;

            summary.expenses_created +=
                1;

            if (completed) {
                summary.rules_completed +=
                    1;
            }

            rule.last_run_date =
                occurrenceDate;

            rule.next_run_date =
                nextRunDate;

            rule.is_active =
                completed
                    ? 0
                    : 1;

            rule.updated_at = now;
        }
    }

    return summary;
}
