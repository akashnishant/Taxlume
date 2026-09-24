import { useEffect, useState } from "react";
import { Plus, Search, Truck } from "lucide-react";
import {
  createVendor,
  getVendor,
  getVendors,
  updateVendor,
  updateVendorStatus,
  type Vendor,
  type CreateVendorRequest,
} from "../services/vendorApi";
import { gstStates } from "../constants/gstStates";
import MasterListEmptyState from "../components/MasterListEmptyState";
import { getApiErrorMessage } from "../utils/apiErrorMessage";
import { validatePartyTaxIds } from "../utils/validatePartyTaxIds";
import LoadingState from "../components/LoadingState";
import ButtonLoadingContent from "../components/ButtonLoadingContent";
import ConfirmDialog from "../components/ConfirmDialog";
import { useNotification } from "../hooks/useNotifications";
import MasterFormModalHeader from "../components/MasterFormModalHeader";

type VendorForm = CreateVendorRequest & {
  address: NonNullable<CreateVendorRequest["address"]>;
  opening_balance_paise: number;
  credit_limit_paise: number;
  payment_terms_days: number;
};

function createEmptyVendorForm(): VendorForm {
  return {
    display_name: "",
    legal_name: "",
    gstin: "",
    pan: "",
    email: "",
    phone: "",
    alternate_phone: "",
    contact_person: "",
    address: {
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      state_code: "",
      pincode: "",
      country: "India",
    },
    opening_balance_paise: 0,
    credit_limit_paise: 0,
    payment_terms_days: 0,
    notes: "",
  };
}

export default function Vendors() {
  const notify = useNotification();

  const [statusTarget, setStatusTarget] = useState<Vendor | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState<VendorForm>(createEmptyVendorForm());

  const [isSaving, setIsSaving] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

  async function loadVendors() {
    try {
      setIsLoading(true);
      setError("");

      const data = await getVendors();
      setVendors(data);
    } catch {
      setError("Unable to load vendors. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadVendors();
  }, []);

  const filteredVendors = vendors.filter((vendor) => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      vendor.display_name,
      vendor.legal_name,
      vendor.email,
      vendor.phone,
      vendor.gstin,
      vendor.pan,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  async function handleSaveVendor() {
    setFormError("");
    if (!form.display_name.trim()) {
      setFormError("Vendor name is required.");
      return;
    }

    if (!form.address.address_line1.trim()) {
      setFormError("Address Line 1 is required.");
      return;
    }

    if (!form.address.city?.trim()) {
      setFormError("City is required.");
      return;
    }

    if (!form.address.state?.trim()) {
      setFormError("State is required.");
      return;
    }

    if (!form.address.state_code?.trim()) {
      setFormError("State Code is required.");
      return;
    }

    if (!form.address.pincode?.trim()) {
      setFormError("Pincode is required.");
      return;
    }

    const taxIdError = validatePartyTaxIds({
      gstin: form.gstin,
      pan: form.pan,
      stateCode: form.address.state_code,
      country: form.address.country,
    });

    if (taxIdError) {
      setFormError(taxIdError);
      return;
    }

    try {
      setIsSaving(true);
      setError("");

      const vendorData: CreateVendorRequest = {
        display_name: form.display_name.trim(),
        legal_name: form.legal_name?.trim() || undefined,
        gstin: form.gstin?.trim() || undefined,
        pan: form.pan?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        alternate_phone: form.alternate_phone?.trim() || undefined,
        contact_person: form.contact_person?.trim() || undefined,

        address: {
          address_line1: form.address.address_line1.trim(),
          address_line2: form.address.address_line2?.trim() || undefined,
          city: form.address.city?.trim() || undefined,
          state: form.address.state?.trim() || undefined,
          state_code: form.address.state_code?.trim() || undefined,
          pincode: form.address.pincode?.trim() || undefined,
          country: form.address.country?.trim() || "India",
        },

        opening_balance_paise: form.opening_balance_paise,
        credit_limit_paise: form.credit_limit_paise,
        payment_terms_days: form.payment_terms_days,

        notes: form.notes?.trim() || undefined,
      };

      const wasEditing = Boolean(editingVendorId);
      const vendorName = vendorData.display_name;

      if (editingVendorId) {
        await updateVendor(editingVendorId, vendorData);
      } else {
        await createVendor(vendorData);
      }

      // The save has succeeded at this point.
      // Handle a subsequent list-refresh failure separately.
      let refreshFailed = false;

      try {
        const data = await getVendors();
        setVendors(data);
      } catch {
        refreshFailed = true;
      }

      setForm(createEmptyVendorForm());
      setEditingVendorId(null);
      setIsAddOpen(false);

      notify({
        type: refreshFailed ? "warning" : "success",
        title: refreshFailed
          ? `Vendor ${wasEditing ? "updated" : "created"}`
          : `Vendor ${wasEditing ? "updated" : "created"} successfully`,
        description: refreshFailed
          ? `"${vendorName}" was saved, but the vendor list could not be refreshed. Reload the page to fetch the latest records.`
          : `"${vendorName}" has been saved to your records.`,
      });
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          editingVendorId
            ? "Unable to update vendor. Please check the details and try again."
            : "Unable to save vendor. Please check the details and try again.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditVendor(id: string) {
    if (loadingEditId !== null) return;

    setLoadingEditId(id);
    try {
      setError("");

      const vendor = await getVendor(id);

      const defaultAddress =
        vendor.addresses.find((address) => address.is_default === 1) ??
        vendor.addresses[0];

      setEditingVendorId(vendor.id);

      setForm({
        display_name: vendor.display_name,
        legal_name: vendor.legal_name ?? "",
        gstin: vendor.gstin ?? "",
        pan: vendor.pan ?? "",
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        alternate_phone: vendor.alternate_phone ?? "",
        contact_person: vendor.contact_person ?? "",

        address: {
          address_line1: defaultAddress?.address_line1 ?? "",
          address_line2: defaultAddress?.address_line2 ?? "",
          city: defaultAddress?.city ?? "",
          state: defaultAddress?.state ?? "",
          state_code: defaultAddress?.state_code ?? "",
          pincode: defaultAddress?.pincode ?? "",
          country: defaultAddress?.country ?? "India",
        },

        opening_balance_paise: vendor.opening_balance_paise,
        credit_limit_paise: vendor.credit_limit_paise,
        payment_terms_days: vendor.payment_terms_days,
        notes: vendor.notes ?? "",
      });

      setFormError("");
      setIsAddOpen(true);
    } catch {
      setError("Unable to load vendor details. Please try again.");
    } finally {
      setLoadingEditId(null);
    }
  }

  function handleToggleVendorStatus(vendor: Vendor) {
    setStatusError("");
    setStatusTarget(vendor);
  }

  async function confirmToggleVendorStatus() {
    if (!statusTarget || isChangingStatus) {
      return;
    }

    const vendor = statusTarget;
    const nextStatus = vendor.is_active !== 1;
    const action = nextStatus ? "activate" : "deactivate";

    setIsChangingStatus(true);
    setStatusError("");
    setError("");

    try {
      await updateVendorStatus(vendor.id, nextStatus);

      setVendors((current) =>
        current.map((item) =>
          item.id === vendor.id
            ? { ...item, is_active: nextStatus ? 1 : 0 }
            : item,
        ),
      );

      let refreshFailed = false;

      try {
        const data = await getVendors();
        setVendors(data);
      } catch {
        refreshFailed = true;
      }

      setStatusTarget(null);

      notify({
        type: refreshFailed ? "warning" : "success",
        title: refreshFailed
          ? `Vendor ${nextStatus ? "activated" : "deactivated"}`
          : `Vendor ${nextStatus ? "activated" : "deactivated"} successfully`,
        description: refreshFailed
          ? "The status was changed, but the vendor list could not be refreshed. Reload the page to fetch the latest records."
          : `"${vendor.display_name}" is now ${
              nextStatus ? "active" : "inactive"
            }.`,
      });
    } catch {
      const message = `Unable to ${action} vendor. Please try again.`;

      setStatusError(message);

      notify({
        type: "error",
        title: `Could not ${action} vendor`,
        description: message,
      });
    } finally {
      setIsChangingStatus(false);
    }
  }

  function closeVendorForm() {
    if (isSaving) return;

    setIsAddOpen(false);
    setFormError("");
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vendors</h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage your vendors and their billing information.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(createEmptyVendorForm());
            setError("");
            setFormError("");
            setIsAddOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200"
        >
          <Plus size={18} />
          Add Vendor
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendors..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <LoadingState
            message="Loading vendors..."
            description="Fetching your vendor records."
          />
        ) : filteredVendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              {search ? (
                "No vendors found"
              ) : (
                <MasterListEmptyState
                  icon={Truck}
                  title="No vendors yet"
                  description="Add your first vendor to get started."
                />
              )}
            </h2>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {search ? "Try a different search term." : ""}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vendor
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    GSTIN
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {vendor.display_name}
                        </p>

                        {vendor.legal_name &&
                          vendor.legal_name !== vendor.display_name && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {vendor.legal_name}
                            </p>
                          )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-0.5 text-sm text-slate-600">
                        <p>{vendor.contact_person || vendor.phone || "-"}</p>

                        {vendor.email && (
                          <p className="text-xs text-slate-400">
                            {vendor.email}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {vendor.gstin || "-"}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={
                          vendor.is_active
                            ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                        }
                      >
                        {vendor.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleEditVendor(vendor.id)}
                          disabled={loadingEditId !== null}
                          className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 inline-flex min-w-16 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loadingEditId === vendor.id ? (
                            <ButtonLoadingContent message="Loading vendor..." />
                          ) : (
                            "Edit"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleVendorStatus(vendor)}
                          className={
                            vendor.is_active
                              ? "inline-flex cursor-pointer items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              : "inline-flex cursor-pointer items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          }
                        >
                          {vendor.is_active ? "Deactivate" : "Activate"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <MasterFormModalHeader
              title={editingVendorId ? "Edit Vendor" : "Add Vendor"}
              description="Add vendor and billing information."
              onClose={closeVendorForm}
              disabled={isSaving}
            />

            {formError && (
              <div className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="overflow-y-auto px-6 py-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Vendor Name *
                  </label>

                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        display_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Legal Name
                  </label>

                  <input
                    type="text"
                    value={form.legal_name ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        legal_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Contact Person
                  </label>

                  <input
                    type="text"
                    value={form.contact_person ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contact_person: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    GSTIN
                  </label>

                  <input
                    type="text"
                    value={form.gstin ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        gstin: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    PAN
                  </label>

                  <input
                    type="text"
                    value={form.pan ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        pan: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>

                  <input
                    type="tel"
                    value={form.phone ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Alternate Phone
                  </label>

                  <input
                    type="tel"
                    value={form.alternate_phone ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        alternate_phone: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Billing Address
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Address Line 1 *
                    </label>

                    <input
                      type="text"
                      value={form.address?.address_line1 ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            address_line1: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Address Line 2
                    </label>

                    <input
                      type="text"
                      value={form.address?.address_line2 ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            address_line2: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      City *
                    </label>

                    <input
                      type="text"
                      value={form.address?.city ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            city: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2px-2.5"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      State *
                    </label>

                    <select
                      value={form.address?.state ?? ""}
                      onChange={(event) => {
                        const selectedState = gstStates.find(
                          (state) => state.name === event.target.value,
                        );

                        setForm((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            state: selectedState?.name ?? "",
                            state_code: selectedState?.code ?? "",
                          },
                        }));
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="">Select state</option>

                      {gstStates.map((state) => (
                        <option key={state.code} value={state.name}>
                          {state.code} - {state.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      State Code *
                    </label>

                    <input
                      type="text"
                      value={form.address?.state_code ?? ""}
                      placeholder="Auto-filled"
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      PIN Code *
                    </label>

                    <input
                      type="text"
                      value={form.address?.pincode ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: {
                            ...current.address,
                            pincode: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Financial Information
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Opening Balance
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.opening_balance_paise / 100}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          opening_balance_paise: Math.round(
                            Number(event.target.value) * 100,
                          ),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Credit Limit
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.credit_limit_paise / 100}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          credit_limit_paise: Math.round(
                            Number(event.target.value) * 100,
                          ),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Payment Terms (Days)
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.payment_terms_days}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          payment_terms_days: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  rows={4}
                  value={form.notes ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeVendorForm}
                disabled={isSaving}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSaveVendor()}
                disabled={isSaving}
                className="cursor-pointer rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <ButtonLoadingContent
                    message={
                      editingVendorId
                        ? "Updating vendor..."
                        : "Creating vendor..."
                    }
                  />
                ) : editingVendorId ? (
                  "Update Vendor"
                ) : (
                  "Save Vendor"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={statusTarget !== null}
        title={
          statusTarget?.is_active === 1
            ? "Deactivate vendor?"
            : "Activate vendor?"
        }
        description={
          <>
            <p>
              Are you sure you want to{" "}
              {statusTarget?.is_active === 1 ? "deactivate" : "activate"}{" "}
              <span className="font-semibold text-slate-800">
                {statusTarget?.display_name}
              </span>
              ?
            </p>

            {statusTarget?.is_active === 1 && (
              <p className="mt-2">
                This vendor will no longer appear in active vendor selections.
                You can activate them again later.
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
            ? "Deactivate vendor"
            : "Activate vendor"
        }
        cancelLabel="Keep current status"
        tone={statusTarget?.is_active === 1 ? "warning" : "default"}
        isProcessing={isChangingStatus}
        onConfirm={confirmToggleVendorStatus}
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
