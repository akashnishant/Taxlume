import { useEffect, useState } from "react";
import { Plus, Search, Users, X } from "lucide-react";
import {
  createCustomer,
  getCustomer,
  getCustomers,
  updateCustomer,
  updateCustomerStatus,
  type Customer,
} from "../services/customerApi";
import type { CreateCustomerRequest } from "../services/customerApi";
import { gstStates } from "../constants/gstStates";
import MasterListEmptyState from "../components/MasterListEmptyState";
import { getApiErrorMessage } from "../utils/apiErrorMessage";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null,
  );

  const [isSaving, setIsSaving] = useState(false);

  function createEmptyCustomerForm(): CreateCustomerRequest {
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

  const [form, setForm] = useState<CreateCustomerRequest>(
    createEmptyCustomerForm(),
  );

  useEffect(() => {
    async function loadCustomers() {
      try {
        setIsLoading(true);
        setError("");

        const data = await getCustomers();
        setCustomers(data);
      } catch {
        setError("Unable to load customers. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter((customer) => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      customer.display_name.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.gstin?.toLowerCase().includes(query)
    );
  });

  async function handleEditCustomer(id: string) {
    try {
      setError("");

      const customer = await getCustomer(id);

      const address =
        customer.addresses.find((item) => item.is_default === 1) ??
        customer.addresses[0];

      setForm({
        display_name: customer.display_name,
        legal_name: customer.legal_name ?? "",
        gstin: customer.gstin ?? "",
        pan: customer.pan ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        alternate_phone: customer.alternate_phone ?? "",
        contact_person: customer.contact_person ?? "",
        address: {
          address_line1: address?.address_line1 ?? "",
          address_line2: address?.address_line2 ?? "",
          city: address?.city ?? "",
          state: address?.state ?? "",
          state_code: address?.state_code ?? "",
          pincode: address?.pincode ?? "",
          country: address?.country ?? "India",
        },
        opening_balance_paise: customer.opening_balance_paise,
        credit_limit_paise: customer.credit_limit_paise,
        payment_terms_days: customer.payment_terms_days,
        notes: customer.notes ?? "",
      });

      setEditingCustomerId(customer.id);
      setFormError("");
      setIsAddOpen(true);
    } catch {
      setError("Unable to load customer details. Please try again.");
    }
  }

  async function handleToggleCustomerStatus(customer: Customer) {
    const nextStatus = customer.is_active !== 1;

    const action = nextStatus ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${customer.display_name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await updateCustomerStatus(customer.id, nextStatus);

      const data = await getCustomers();

      setCustomers(data);
    } catch {
      setError(`Unable to ${action} customer. Please try again.`);
    }
  }

  async function handleSaveCustomer() {
    setFormError("");
    if (!form.display_name.trim()) {
      setFormError("Customer name is required.");
      return;
    }

    if (!form.address?.address_line1.trim()) {
      setFormError("Address Line 1 is required.");
      return;
    }

    if (!form.address?.city?.trim()) {
      setFormError("City is required.");
      return;
    }

    if (!form.address?.state?.trim()) {
      setFormError("State is required.");
      return;
    }

    if (!form.address?.state_code?.trim()) {
      setFormError("State Code is required.");
      return;
    }

    if (!form.address?.pincode?.trim()) {
      setFormError("Pincode is required.");
      return;
    }

    try {
      setError("");
      setIsSaving(true);

      const payload: CreateCustomerRequest = {
        ...form,
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
        notes: form.notes?.trim() || undefined,
      };

      if (editingCustomerId) {
        await updateCustomer(editingCustomerId, payload);
      } else {
        await createCustomer(payload);
      }

      const data = await getCustomers();

      setCustomers(data);
      setIsAddOpen(false);
      setEditingCustomerId(null);
      setForm(createEmptyCustomerForm());
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          editingCustomerId
            ? "Unable to update customer. Please check the details and try again."
            : "Unable to create customer. Please check the details and try again.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customers</h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage your customers and their billing information.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingCustomerId(null);
            setForm(createEmptyCustomerForm());
            setError("");
            setFormError("");
            setIsAddOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus size={18} />
          Add Customer
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
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-slate-500">Loading customers...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {search ? (
                "No customers found"
              ) : (
                <MasterListEmptyState
                  icon={Users}
                  title="No customers yet"
                  description="Add your first customer to start creating invoices."
                />
              )}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {search ? "Try a different search term." : ""}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </th>

                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    GSTIN
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
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">
                        {customer.display_name}
                      </p>

                      {customer.legal_name && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {customer.legal_name}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">
                        {customer.email || "—"}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {customer.phone || "—"}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {customer.gstin || "—"}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={
                          customer.is_active
                            ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        }
                      >
                        {customer.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditCustomer(customer.id)}
                          className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleCustomerStatus(customer)}
                          className={
                            customer.is_active
                              ? "inline-flex cursor-pointer items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              : "inline-flex cursor-pointer items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          }
                        >
                          {customer.is_active ? "Deactivate" : "Activate"}
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingCustomerId ? "Edit Customer" : "Add Customer"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the customer's billing information.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setFormError("");
                }}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="space-y-6 p-6">
              <section>
                <h4 className="mb-4 text-sm font-semibold text-slate-900">
                  Basic Information
                </h4>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Customer Name *
                    </label>

                    <input
                      type="text"
                      value={form.display_name}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          display_name: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      placeholder="Customer or business name"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Legal Name
                    </label>

                    <input
                      type="text"
                      value={form.legal_name}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          legal_name: event.target.value,
                        })
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
                      value={form.contact_person}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          contact_person: event.target.value,
                        })
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
                      value={form.gstin}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          gstin: event.target.value.toUpperCase(),
                        })
                      }
                      maxLength={15}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      PAN
                    </label>

                    <input
                      type="text"
                      value={form.pan}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          pan: event.target.value.toUpperCase(),
                        })
                      }
                      maxLength={10}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email
                    </label>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          email: event.target.value,
                        })
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
                      value={form.phone}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          phone: event.target.value,
                        })
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
                      value={form.alternate_phone}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          alternate_phone: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h4 className="mb-4 text-sm font-semibold text-slate-900">
                  Billing Address
                </h4>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Address Line 1 *
                    </label>

                    <input
                      type="text"
                      value={form.address?.address_line1 ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          address: {
                            ...form.address,
                            address_line1: event.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Address Line 2
                    </label>

                    <input
                      type="text"
                      value={form.address?.address_line2 ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          address: {
                            address_line1: form.address?.address_line1 ?? "",
                            address_line2: event.target.value,
                            city: form.address?.city ?? "",
                            state: form.address?.state ?? "",
                            state_code: form.address?.state_code ?? "",
                            pincode: form.address?.pincode ?? "",
                            country: form.address?.country ?? "India",
                          },
                        })
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
                        setForm({
                          ...form,
                          address: {
                            address_line1: form.address?.address_line1 ?? "",
                            address_line2: form.address?.address_line2 ?? "",
                            city: event.target.value,
                            state: form.address?.state ?? "",
                            state_code: form.address?.state_code ?? "",
                            pincode: form.address?.pincode ?? "",
                            country: form.address?.country ?? "India",
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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

                        setForm({
                          ...form,
                          address: {
                            address_line1: form.address?.address_line1 ?? "",
                            address_line2: form.address?.address_line2 ?? "",
                            city: form.address?.city ?? "",
                            state: selectedState?.name ?? "",
                            state_code: selectedState?.code ?? "",
                            pincode: form.address?.pincode ?? "",
                            country: form.address?.country ?? "India",
                          },
                        });
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
                        setForm({
                          ...form,
                          address: {
                            address_line1: form.address?.address_line1 ?? "",
                            address_line2: form.address?.address_line2 ?? "",
                            city: form.address?.city ?? "",
                            state: form.address?.state ?? "",
                            state_code: form.address?.state_code ?? "",
                            pincode: event.target.value,
                            country: form.address?.country ?? "India",
                          },
                        })
                      }
                      maxLength={10}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h4 className="mb-4 text-sm font-semibold text-slate-900">
                  Financial Information
                </h4>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Opening Balance
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(form.opening_balance_paise ?? 0) / 100}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          opening_balance_paise: Math.round(
                            Number(event.target.value) * 100,
                          ),
                        })
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
                      value={(form.credit_limit_paise ?? 0) / 100}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          credit_limit_paise: Math.round(
                            Number(event.target.value) * 100,
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Payment Terms
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.payment_terms_days ?? 0}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          payment_terms_days: Math.max(
                            0,
                            Math.floor(Number(event.target.value)),
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />

                    <p className="mt-1 text-xs text-slate-400">Days</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="mb-4 text-sm font-semibold text-slate-900">
                  Notes
                </h4>

                <textarea
                  rows={4}
                  maxLength={5000}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      notes: event.target.value,
                    })
                  }
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setFormError("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveCustomer}
                disabled={isSaving}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Saving..."
                  : editingCustomerId
                    ? "Update Customer"
                    : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
