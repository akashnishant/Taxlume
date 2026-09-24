/**
 * Returns true only when the category can be used for a NEW expense.
 *
 * Historical expenses may continue to reference inactive categories;
 * this function is for creation and category-changing edits.
 *
 * Company ownership, category status, parent status, and the maximum
 * two-level hierarchy are checked in a single scoped query.
 */
export async function isExpenseCategorySelectable(
    db: D1Database,
    companyId: string,
    categoryId: string,
): Promise<boolean> {
    const category = await db
        .prepare(`
            SELECT child.id
            FROM expense_categories AS child
            LEFT JOIN expense_categories AS parent
                ON parent.id = child.parent_category_id
               AND parent.company_id = child.company_id
            WHERE child.id = ?
              AND child.company_id = ?
              AND child.is_active = 1
              AND (
                  child.parent_category_id IS NULL
                  OR (
                      parent.id IS NOT NULL
                      AND parent.is_active = 1
                      AND parent.parent_category_id IS NULL
                  )
              )
            LIMIT 1
        `)
        .bind(categoryId, companyId)
        .first<{ id: string }>();

    return category !== null;
}
