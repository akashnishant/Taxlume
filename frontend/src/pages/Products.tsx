import { useEffect, useMemo, useState } from "react";
import { Plus, Package, Search } from "lucide-react";
import {
  createProduct,
  getProduct,
  getProducts,
  updateProduct,
  updateProductStatus,
  type CreateProductRequest,
  type Product,
} from "../services/productApi";
import MasterListEmptyState from "../components/MasterListEmptyState";
import LoadingState from "../components/LoadingState";
import ButtonLoadingContent from "../components/ButtonLoadingContent";
import ConfirmDialog from "../components/ConfirmDialog";
import { useNotification } from "../hooks/useNotifications";
import MasterFormModalHeader from "../components/MasterFormModalHeader";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

type ProductForm = CreateProductRequest & {
  item_type: "PRODUCT" | "SERVICE";
  name: string;
  description: string;
  sku: string;
  hsn_sac: string;
  unit: string;
  selling_price_paise: number;
  purchase_price_paise: number;
  gst_rate_bps: number;
  cess_rate_bps: number;
  opening_stock_milli: number;
  track_inventory: boolean;
};

function createEmptyProductForm(): ProductForm {
  return {
    item_type: "PRODUCT",
    name: "",
    description: "",
    sku: "",
    hsn_sac: "",
    unit: "",
    selling_price_paise: 0,
    purchase_price_paise: 0,
    gst_rate_bps: 0,
    cess_rate_bps: 0,
    opening_stock_milli: 0,
    track_inventory: true,
  };
}

export default function Products() {
  const notify = useNotification();

  const [statusTarget, setStatusTarget] = useState<Product | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState<ProductForm>(createEmptyProductForm());

  const [isSaving, setIsSaving] = useState(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  async function loadProducts() {
    try {
      setIsLoading(true);
      setError("");

      const data = await getProducts();
      setProducts(data);
    } catch {
      setError("Unable to load products and services. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.hsn_sac,
        product.unit,
        product.item_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [products, search]);

  async function handleCreateProduct() {
    if (isSaving) return;

    setFormError("");
    if (!form.name.trim()) {
      setFormError("Product or service name is required.");
      return;
    }

    if (!form.unit.trim()) {
      setFormError("Unit is required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: CreateProductRequest = {
        item_type: form.item_type,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        sku: form.sku.trim() || undefined,
        hsn_sac: form.hsn_sac.trim() || undefined,
        unit: form.unit.trim(),
        selling_price_paise: form.selling_price_paise,
        purchase_price_paise: form.purchase_price_paise,
        gst_rate_bps: form.gst_rate_bps,
        cess_rate_bps: form.cess_rate_bps,
        opening_stock_milli: form.opening_stock_milli,
        track_inventory: form.track_inventory,
      };

      const wasEditing = Boolean(editingProductId);
      const productName = payload.name;

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
      } else {
        await createProduct(payload);
      }

      // The create/update request succeeded.
      // Do not treat a later refresh failure as a save failure.
      let refreshFailed = false;

      try {
        const data = await getProducts();
        setProducts(data);
      } catch {
        refreshFailed = true;
      }

      setIsAddOpen(false);
      setEditingProductId(null);
      setForm(createEmptyProductForm());

      notify({
        type: refreshFailed ? "warning" : "success",
        title: refreshFailed
          ? `Product ${wasEditing ? "updated" : "created"}`
          : `Product ${wasEditing ? "updated" : "created"} successfully`,
        description: refreshFailed
          ? `"${productName}" was saved, but the product list could not be refreshed. Reload the page to fetch the latest records.`
          : `"${productName}" has been saved to your records.`,
      });
    } catch {
      setFormError(
        editingProductId
          ? "Unable to update product. Please try again."
          : "Unable to create product. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditProduct(id: string) {
    if (loadingEditId !== null) return;

    setLoadingEditId(id);
    setError("");

    try {
      const product = await getProduct(id);

      setForm({
        item_type: product.item_type,
        name: product.name,
        description: product.description ?? "",
        sku: product.sku ?? "",
        hsn_sac: product.hsn_sac ?? "",
        unit: product.unit,
        selling_price_paise: product.selling_price_paise,
        purchase_price_paise: product.purchase_price_paise,
        gst_rate_bps: product.gst_rate_bps,
        cess_rate_bps: product.cess_rate_bps,
        opening_stock_milli: product.opening_stock_milli,
        track_inventory: Boolean(product.track_inventory),
      });

      setFormError("");
      setEditingProductId(product.id);
      setIsAddOpen(true);
    } catch {
      setError("Unable to load product. Please try again.");
    } finally {
      setLoadingEditId(null);
    }
  }

  function handleToggleProductStatus(product: Product) {
    setStatusError("");
    setStatusTarget(product);
  }

  async function confirmToggleProductStatus() {
    if (!statusTarget || isChangingStatus) {
      return;
    }

    const product = statusTarget;
    const nextStatus = product.is_active !== 1;
    const action = nextStatus ? "activate" : "deactivate";

    setIsChangingStatus(true);
    setStatusError("");
    setError("");

    try {
      await updateProductStatus(product.id, nextStatus);

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, is_active: nextStatus ? 1 : 0 }
            : item,
        ),
      );

      let refreshFailed = false;

      try {
        const data = await getProducts();
        setProducts(data);
      } catch {
        refreshFailed = true;
      }

      setStatusTarget(null);

      notify({
        type: refreshFailed ? "warning" : "success",
        title: refreshFailed
          ? `Product ${nextStatus ? "activated" : "deactivated"}`
          : `Product ${nextStatus ? "activated" : "deactivated"} successfully`,
        description: refreshFailed
          ? "The status was changed, but the product list could not be refreshed. Reload the page to fetch the latest records."
          : `"${product.name}" is now ${nextStatus ? "active" : "inactive"}.`,
      });
    } catch {
      const message = `Unable to ${action} product. Please try again.`;

      setStatusError(message);

      notify({
        type: "error",
        title: `Could not ${action} product`,
        description: message,
      });
    } finally {
      setIsChangingStatus(false);
    }
  }

  function closeProductForm() {
    if (isSaving) return;

    setIsAddOpen(false);
    setFormError("");
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Products &amp; Services
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage your products, services, pricing and inventory.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setForm(createEmptyProductForm());
            setEditingProductId(null);
            setError("");
            setIsAddOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products or services..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingState
            message="Loading products and services..."
            description="Fetching your product and service catalogue."
          />
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              {search ? (
                "No matching products or services"
              ) : (
                <MasterListEmptyState
                  icon={Package}
                  title="No products or services yet"
                  description="Add your first product or service to get started."
                />
              )}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {search ? "Try a different search term." : ""}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Item
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Type
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    SKU / HSN-SAC
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selling Price
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    GST
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Unit: {product.unit}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {product.item_type === "SERVICE"
                          ? "Service"
                          : "Product"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700">
                        <p>{product.sku || "-"}</p>

                        <p className="mt-1 text-xs text-slate-500">
                          HSN/SAC: {product.hsn_sac || "-"}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {formatRupees(product.selling_price_paise)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {(product.gst_rate_bps / 100).toFixed(2)}%
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={
                          product.is_active
                            ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                        }
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 inline-flex min-w-16 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleEditProduct(product.id)}
                          disabled={loadingEditId !== null}
                        >
                          {loadingEditId === product.id ? (
                            <ButtonLoadingContent message="Loading product..." />
                          ) : (
                            "Edit"
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleToggleProductStatus(product)
                          }
                          className={
                            product.is_active
                              ? "inline-flex cursor-pointer items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              : "inline-flex cursor-pointer items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          }
                        >
                          {product.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <MasterFormModalHeader
              title={editingProductId ? "Edit Product" : "Add Product"}
              description={
                editingProductId
                  ? "Update the product or service details."
                  : "Add a product or service to your catalog."
              }
              onClose={closeProductForm}
              disabled={isSaving}
            />

            <div className="min-h-0 overflow-y-auto p-6">
              {formError && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Item Type
                  </label>

                  <select
                    value={form.item_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        item_type: event.target.value as "PRODUCT" | "SERVICE",
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="PRODUCT">Product</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Name
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Product or service name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div className="mt-5 sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>

                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Optional description"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    SKU
                  </label>

                  <input
                    type="text"
                    value={form.sku}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sku: event.target.value,
                      }))
                    }
                    placeholder="Optional SKU"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    HSN / SAC
                  </label>

                  <input
                    type="text"
                    value={form.hsn_sac}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        hsn_sac: event.target.value,
                      }))
                    }
                    placeholder="Optional HSN / SAC"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Unit
                  </label>

                  <input
                    type="text"
                    value={form.unit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unit: event.target.value,
                      }))
                    }
                    placeholder="e.g. NOS, KG, HOUR"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Selling Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.selling_price_paise / 100}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        selling_price_paise: Math.round(
                          Number(event.target.value || 0) * 100,
                        ),
                      }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Purchase Price (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchase_price_paise / 100}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        purchase_price_paise: Math.round(
                          Number(event.target.value || 0) * 100,
                        ),
                      }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    GST Rate (%)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gst_rate_bps / 100}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        gst_rate_bps: Math.round(
                          Number(event.target.value || 0) * 100,
                        ),
                      }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Cess Rate (%)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cess_rate_bps / 100}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cess_rate_bps: Math.round(
                          Number(event.target.value || 0) * 100,
                        ),
                      }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Opening Stock
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.opening_stock_milli / 1000}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        opening_stock_milli: Math.round(
                          Number(event.target.value || 0) * 1000,
                        ),
                      }))
                    }
                    placeholder="0"
                    disabled={!form.track_inventory}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.track_inventory}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          track_inventory: event.target.checked,
                          opening_stock_milli: event.target.checked
                            ? current.opening_stock_milli
                            : 0,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />

                    <span>
                      <span className="block text-sm font-medium text-slate-700">
                        Track Inventory
                      </span>
                      <span className="block text-xs text-slate-500">
                        Maintain stock quantities for this item.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeProductForm}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void handleCreateProduct()}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <ButtonLoadingContent
                      message={
                        editingProductId
                          ? "Updating product..."
                          : "Creating product..."
                      }
                    />
                  ) : editingProductId ? (
                    "Update Product"
                  ) : (
                    "Create Product"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={statusTarget !== null}
        title={
          statusTarget?.is_active === 1
            ? "Deactivate product?"
            : "Activate product?"
        }
        description={
          <>
            <p>
              Are you sure you want to{" "}
              {statusTarget?.is_active === 1 ? "deactivate" : "activate"}{" "}
              <span className="font-semibold text-slate-800">
                {statusTarget?.name}
              </span>
              ?
            </p>

            {statusTarget?.is_active === 1 && (
              <p className="mt-2">
                This product or service will no longer appear in active
                selections. You can activate it again later.
              </p>
            )}

            {statusError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {statusError}
              </p>
            )}
          </>
        }
        confirmLabel={
          statusTarget?.is_active === 1
            ? "Deactivate product"
            : "Activate product"
        }
        cancelLabel="Keep current status"
        tone={statusTarget?.is_active === 1 ? "warning" : "default"}
        isProcessing={isChangingStatus}
        onConfirm={confirmToggleProductStatus}
        onCancel={() => {
          if (!isChangingStatus) {
            setStatusTarget(null);
            setStatusError("");
          }
        }}
      />
    </main>
  );
}
