type DefaultCategory = {
    name: string;
    children?: readonly string[];
};

const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
    { name: "Rent" },
    {
        name: "Utilities",
        children: ["Electricity", "Internet", "Telephone"],
    },
    {
        name: "Travel",
        children: ["Local Travel", "Flights", "Hotels"],
    },
    { name: "Office & Supplies" },
    { name: "Software & Subscriptions" },
    { name: "Professional Fees" },
    { name: "Marketing & Advertising" },
    { name: "Repairs & Maintenance" },
    { name: "Banking & Finance" },
    { name: "Taxes & Government Fees" },
    { name: "Other" },
];

export async function ensureDefaultCategories(
    db: D1Database,
    companyId: string,
    userId: string,
): Promise<void> {
    const existing = await db
        .prepare(`
            SELECT id
            FROM expense_categories
            WHERE company_id = ?
            LIMIT 1
        `)
        .bind(companyId)
        .first<{ id: string }>();

    if (existing) {
        return;
    }

    const now = new Date().toISOString();

    const insertCategory = db.prepare(`
        INSERT INTO expense_categories (
            id,
            company_id,
            name,
            parent_category_id,
            display_order,
            is_active,
            created_by,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    const parentStatements: D1PreparedStatement[] = [];
    const childStatements: D1PreparedStatement[] = [];

    for (const [parentIndex, category] of DEFAULT_CATEGORIES.entries()) {
        const parentId = crypto.randomUUID();

        parentStatements.push(
            insertCategory.bind(
                parentId,
                companyId,
                category.name,
                null,
                parentIndex + 1,
                userId,
                now,
                now,
            ),
        );

        for (const [childIndex, childName] of (
            category.children ?? []
        ).entries()) {
            childStatements.push(
                insertCategory.bind(
                    crypto.randomUUID(),
                    companyId,
                    childName,
                    parentId,
                    childIndex + 1,
                    userId,
                    now,
                    now,
                ),
            );
        }
    }

    try {
        // D1 executes a batch transactionally. Parent rows are inserted
        // before their children to satisfy the foreign-key relationships.
        await db.batch([
            ...parentStatements,
            ...childStatements,
        ]);
    } catch (error) {
        // Another first-time request may have initialized the same
        // company concurrently. Accept that race only if the complete
        // set of defaults now exists; otherwise surface the real error.
        const result = await db
            .prepare(`
                SELECT COUNT(*) AS count
                FROM expense_categories
                WHERE company_id = ?
            `)
            .bind(companyId)
            .first<{ count: number }>();

        if (
            /UNIQUE constraint failed/i.test(String(error)) &&
            result?.count === 17
        ) {
            return;
        }

        console.error(
            "Expense category initialization failed:",
            error,
        );

        throw error;
    }
}
