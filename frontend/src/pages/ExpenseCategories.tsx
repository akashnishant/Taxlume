import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoadingState from "../components/LoadingState";
import ExpenseCategoryFormModal from "../components/ExpenseCategoryFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useNotification } from "../hooks/useNotifications";
import {
  getExpenseCategories,
  setExpenseCategoryActive,
  type ExpenseCategory,
} from "../services/expenseCategoryApi";
import { getApiErrorMessage } from "../utils/apiErrorMessage";

function orderCategories(
  first: ExpenseCategory,
  second: ExpenseCategory,
): number {
  return (
    first.display_order - second.display_order ||
    first.name.localeCompare(second.name)
  );
}

export default function ExpenseCategories() {
  const notify = useNotification();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingStatusCategory, setPendingStatusCategory] =
    useState<ExpenseCategory | null>(null);
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    getExpenseCategories()
      .then((result) => {
        if (!cancelled) setCategories(result);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;

        setCategories([]);
        setError(
          getApiErrorMessage(
            requestError,
            "Unable to load expense categories.",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function confirmCategoryStatus() {
    if (!pendingStatusCategory || isProcessingStatus) return;

    const category = pendingStatusCategory;
    const activating = category.is_active !== 1;

    // Prevent activating a child while its parent is inactive.
    if (activating && category.parent_category_id) {
      const parent = categories.find(
        (item) => item.id === category.parent_category_id,
      );

      if (!parent || parent.is_active !== 1) {
        setPendingStatusCategory(null);

        notify({
          type: "warning",
          title: "Parent category is inactive",
          description: "Activate the parent category first.",
        });

        return;
      }
    }

    setIsProcessingStatus(true);

    try {
      await setExpenseCategoryActive(category.id, activating);

      notify({
        type: "success",
        title: activating
          ? "Category activated"
          : "Category deactivated",
        description: activating
          ? `"${category.name}" is now active.`
          : `"${category.name}" is now inactive.`,
      });

      setPendingStatusCategory(null);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      notify({
        type: "error",
        title: activating
          ? "Unable to activate category"
          : "Unable to deactivate category",
        description: getApiErrorMessage(
          requestError,
          "Please refresh the categories and try again.",
        ),
      });

      setPendingStatusCategory(null);
      setRefreshKey((current) => current + 1);
    } finally {
      setIsProcessingStatus(false);
    }
  }

  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const parents = categories
    .filter((category) => category.parent_category_id === null)
    .sort(orderCategories);

  const orderedCategories = [
    ...parents.flatMap((parent) => [
      parent,
      ...categories
        .filter((category) => category.parent_category_id === parent.id)
        .sort(orderCategories),
    ]),
    ...categories
      .filter(
        (category) =>
          category.parent_category_id !== null &&
          !categoryById.has(category.parent_category_id),
      )
      .sort(orderCategories),
  ];

  function statusLabel(category: ExpenseCategory): string {
    if (category.is_active !== 1) return "Inactive";

    const parent = category.parent_category_id
      ? categoryById.get(category.parent_category_id)
      : null;

    if (category.parent_category_id && parent?.is_active !== 1) {
      return "Unavailable (parent inactive)";
    }

    return "Active";
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-600">
          View business expenses recorded manually or generated from recurring rules.
        </p>
      </header>

      <nav
        aria-label="Expenses sections"
        className="flex flex-wrap gap-2 border-b border-slate-200"
      >
        <Link
          to="/expenses"
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          All expenses
        </Link>

        <Link
          to="/expenses/recurring"
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Recurring expenses
        </Link>

        <span
          aria-current="page"
          className="border-b-2 border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          Categories
        </span>
        <Link
          to="/expenses/reports"
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Reports
        </Link>
      </nav>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditingCategoryId(null);
            setShowCategoryForm(true);
          }}
          className="rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"
        >
          New category
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Expense categories
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Parent categories and their subcategories.
            </p>
          </div>

          <span className="text-sm text-slate-500">
            {loading
              ? "Loading..."
              : `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-10">
            <LoadingState
              message="Loading expense categories..."
              description="Retrieving your category hierarchy."
            />
          </div>
        ) : error ? (
          <div className="space-y-3 px-5 py-8">
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        ) : orderedCategories.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-600">
            No expense categories found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Parent
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Description
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {orderedCategories.map((category) => {
                  const parent = category.parent_category_id
                    ? categoryById.get(category.parent_category_id)
                    : null;

                  const status = statusLabel(category);

                  return (
                    <tr key={category.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div
                          className={
                            parent ? "pl-5" : ""
                          }
                        >
                          <p
                            className={
                              parent
                                ? "font-medium text-slate-800"
                                : "font-semibold text-slate-900"
                            }
                          >
                            {parent && (
                              <span
                                aria-hidden="true"
                                className="mr-2 text-slate-400"
                              >
                                /
                              </span>
                            )}
                            {category.name}
                          </p>
                          {parent && (
                            <p className="mt-1 text-xs text-slate-500">
                              Subcategory
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {parent?.name ??
                          (category.parent_category_id
                            ? "Parent unavailable"
                            : "-")}
                      </td>

                      <td className="max-w-xs break-words px-5 py-4 text-slate-600">
                        {category.description || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            status === "Active"
                              ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                              : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                          }
                        >
                          {status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setShowCategoryForm(true);
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={
                              Boolean(category.parent_category_id) &&
                              parent?.is_active !== 1
                            }
                            title={
                              category.is_active !== 1 &&
                              category.parent_category_id &&
                              parent?.is_active !== 1
                                ? "Activate the parent category first"
                                : undefined
                            }
                            onClick={() =>
                              setPendingStatusCategory(category)
                            }
                            className={
                              category.is_active === 1
                                ? "rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                                : "rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                            }
                          >
                            {category.is_active === 1
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingStatusCategory !== null}
        title={
          pendingStatusCategory?.is_active === 1
            ? "Deactivate category?"
            : "Activate category?"
        }
        description={
          pendingStatusCategory
            ? pendingStatusCategory.is_active === 1
              ? categories.some(
                  (item) =>
                    item.parent_category_id === pendingStatusCategory.id &&
                    item.is_active === 1,
                )
                ? `Deactivate "${pendingStatusCategory.name}"? Its subcategories will become unavailable for new expenses until this parent is reactivated. Existing expense records will remain unchanged.`
                : `Deactivate "${pendingStatusCategory.name}"? It will no longer be available for new expenses. Existing expense records will remain unchanged.`
              : `Activate "${pendingStatusCategory.name}"? It will become available for new expenses if its parent category is also active.`
            : ""
        }
        confirmLabel={
          pendingStatusCategory?.is_active === 1
            ? "Deactivate category"
            : "Activate category"
        }
        tone={
          pendingStatusCategory?.is_active === 1
            ? "warning"
            : "default"
        }
        isProcessing={isProcessingStatus}
        onConfirm={confirmCategoryStatus}
        onCancel={() => {
          if (!isProcessingStatus) setPendingStatusCategory(null);
        }}
      />

      {showCategoryForm && (
        <ExpenseCategoryFormModal
          editingCategoryId={editingCategoryId ?? undefined}
          onClose={() => {
            setShowCategoryForm(false);
            setEditingCategoryId(null);
          }}
          onSaved={(saved) => {
            const wasEditing = editingCategoryId !== null;

            setShowCategoryForm(false);
            setEditingCategoryId(null);
            setRefreshKey((current) => current + 1);

            notify({
              type: "success",
              title: wasEditing ? "Category updated" : "Category created",
              description: `"${saved.name}" has been ${
                wasEditing ? "updated" : "created"
              } successfully.`,
            });
          }}
        />
      )}
    </main>
  );
}