import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import LoadingState from "./LoadingState";
import { useNotification } from "../hooks/useNotifications";
import { getApiErrorMessage } from "../utils/apiErrorMessage";
import {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategory,
  updateExpenseCategory,
  type ExpenseCategory,
  type UpdateExpenseCategoryRequest,
} from "../services/expenseCategoryApi";

type Props = {
  editingCategoryId?: string;
  onClose: () => void;
  onSaved: (category: ExpenseCategory) => void;
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

const labelClass = "block text-sm font-medium text-slate-700";

export default function ExpenseCategoryFormModal({
  editingCategoryId,
  onClose,
  onSaved,
}: Props) {
  const notify = useNotification();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loadedCategory, setLoadedCategory] =
    useState<ExpenseCategory | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      try {
        const [categoryList, existingCategory] = await Promise.all([
          getExpenseCategories(),
          editingCategoryId
            ? getExpenseCategory(editingCategoryId)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setCategories(categoryList);

        if (existingCategory) {
          setLoadedCategory(existingCategory);
          setName(existingCategory.name);
          setParentId(existingCategory.parent_category_id ?? "");
          setDescription(existingCategory.description ?? "");
          setDisplayOrder(String(existingCategory.display_order));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            getApiErrorMessage(
              error,
              "Unable to load the category form.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadForm();

    return () => {
      cancelled = true;
    };
  }, [editingCategoryId]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, saving]);

  const hasChildren = Boolean(
    loadedCategory &&
      categories.some(
        (category) =>
          category.parent_category_id === loadedCategory.id,
      ),
  );

  const parentOptions = categories
    .filter(
      (category) =>
        category.parent_category_id === null &&
        category.id !== editingCategoryId &&
        (category.is_active === 1 ||
          category.id === loadedCategory?.parent_category_id),
    )
    .sort(
      (first, second) =>
        first.display_order - second.display_order ||
        first.name.localeCompare(second.name),
    );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || saving || loadError) return;

    setFormError("");

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const nextParentId = parentId || null;

    if (!trimmedName || trimmedName.length > 100) {
      setFormError("Enter a category name of up to 100 characters.");
      return;
    }

    if (trimmedDescription.length > 500) {
      setFormError("Description must not exceed 500 characters.");
      return;
    }

    if (!/^\d+$/.test(displayOrder.trim())) {
      setFormError("Display order must be a whole number.");
      return;
    }

    const nextDisplayOrder = Number(displayOrder);

    if (
      !Number.isInteger(nextDisplayOrder) ||
      nextDisplayOrder < 0 ||
      nextDisplayOrder > 10000
    ) {
      setFormError("Display order must be between 0 and 10000.");
      return;
    }

    if (hasChildren && nextParentId !== null) {
      setFormError(
        "A category with subcategories cannot become a subcategory.",
      );
      return;
    }

    if (nextParentId) {
      const selectedParent = categories.find(
        (category) => category.id === nextParentId,
      );

      if (
        !selectedParent ||
        selectedParent.parent_category_id !== null ||
        (
          selectedParent.is_active !== 1 &&
          nextParentId !== loadedCategory?.parent_category_id
        )
      ) {
        setFormError("Select an active top-level parent category.");
        return;
      }
    }

    if (editingCategoryId && !loadedCategory) {
      setFormError("Category details are not available for editing.");
      return;
    }

    const nextDescription = trimmedDescription || null;

    const changes: UpdateExpenseCategoryRequest = {
      // Required by the category Update API, even for other changes.
      name: trimmedName,
    };

    if (loadedCategory) {
      if (nextParentId !== loadedCategory.parent_category_id) {
        changes.parent_category_id = nextParentId;
      }

      if (nextDescription !== loadedCategory.description) {
        changes.description = nextDescription;
      }

      if (nextDisplayOrder !== loadedCategory.display_order) {
        changes.display_order = nextDisplayOrder;
      }

      if (
        trimmedName === loadedCategory.name &&
        Object.keys(changes).length === 1
      ) {
        setFormError("No changes to save.");
        return;
      }
    }

    setSaving(true);

    try {
      const saved = editingCategoryId
        ? await updateExpenseCategory(editingCategoryId, changes)
        : await createExpenseCategory({
            name: trimmedName,
            parent_category_id: nextParentId,
            description: nextDescription,
            display_order: nextDisplayOrder,
          });

      onSaved(saved);
    } catch (error) {
      notify({
        type: "error",
        title: editingCategoryId
          ? "Unable to update category"
          : "Unable to create category",
        description: getApiErrorMessage(
          error,
          "Please check the category details and try again.",
        ),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-category-form-title"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="expense-category-form-title"
              className="text-xl font-bold text-slate-900"
            >
              {editingCategoryId ? "Edit category" : "New category"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {editingCategoryId
                ? "Update this category and its position in the hierarchy."
                : "Create a top-level category or a subcategory."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close category form"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingState
              message="Loading category form..."
              description="Retrieving your expense categories."
            />
          </div>
        ) : loadError ? (
          <div className="space-y-4 p-6">
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-col"
          >
            <fieldset
              disabled={saving}
              className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
            >
              {formError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}

              <label className={labelClass}>
                Category name <span className="text-red-600">*</span>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Team refreshments"
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Parent category
                <select
                  value={parentId}
                  disabled={hasChildren}
                  onChange={(event) => setParentId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">None — top-level category</option>

                  {parentOptions.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                      disabled={category.is_active !== 1}
                    >
                      {category.name}
                      {category.is_active !== 1 ? " (Inactive)" : ""}
                    </option>
                  ))}
                </select>

                {hasChildren && (
                  <span className="mt-1 block text-xs text-slate-500">
                    This category already has subcategories, so its
                    parent cannot be changed.
                  </span>
                )}
              </label>

              <label className={labelClass}>
                Description (optional)
                <textarea
                  rows={3}
                  maxLength={500}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="What expenses belong in this category?"
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Display order
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  required
                  value={displayOrder}
                  onChange={(event) =>
                    setDisplayOrder(event.target.value)
                  }
                  className={inputClass}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Lower numbers appear first within the same level.
                </span>
              </label>
            </fieldset>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingCategoryId
                    ? "Save changes"
                    : "Create category"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}