import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { gstStates } from "../constants/gstStates";
import { getCompany, type Company } from "../services/companyApi";
import type { DocumentFormConfig } from "../types/documentFormConfig";
import { getDocumentSupplierStateCode } from "../utils/documentTaxContext";
import { getProducts, type Product } from "../services/productApi";
import { createDocument } from "../services/invoiceApi";

import type { DocumentFormItem } from "../types/documentForm";

import {
  getGrossPaise,
  getGstPaise,
  getTaxableAmountPaise,
  getTodayDate,
  getQuantityMilli,
} from "../utils/documentCalculations";

import { formatMoneyPaise } from "../utils/documentDisplay";

import { getDocumentProductRatePaise } from "../utils/documentProductPrice";

import ButtonLoadingContent from "./ButtonLoadingContent";
import { useNotification } from "../hooks/useNotifications";

type DocumentEntryFormProps = {
  config: DocumentFormConfig;
};

export default function DocumentEntryForm({ config }: DocumentEntryFormProps) {
  const navigate = useNavigate();

  const notify = useNotification();

  const [company, setCompany] = useState<Company | null>(null);

  const [isCompanyLoading, setIsCompanyLoading] = useState(true);

  const [companyLoadError, setCompanyLoadError] = useState("");

  const [documentDate, setDocumentDate] = useState(getTodayDate);

  const [partyId, setPartyId] = useState("");

  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState("");

  const [products, setProducts] = useState<Product[]>([]);

  const [isProductsLoading, setIsProductsLoading] = useState(false);

  const [productLoadError, setProductLoadError] = useState("");

  const [items, setItems] = useState<DocumentFormItem[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function loadCompany() {
      setIsCompanyLoading(true);
      setCompanyLoadError("");

      try {
        const response = await getCompany();

        setCompany(response);
      } catch {
        setCompany(null);
        setCompanyLoadError(
          "Unable to load company details. Please try again.",
        );
      } finally {
        setIsCompanyLoading(false);
      }
    }

    void loadCompany();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      setIsProductsLoading(true);
      setProductLoadError("");

      try {
        const response = await getProducts();

        setProducts(response);
      } catch {
        setProducts([]);
        setProductLoadError(
          "Unable to load products and services. Please try again.",
        );
      } finally {
        setIsProductsLoading(false);
      }
    }

    void loadProducts();
  }, []);

  const selectedParty =
    config.parties.find((party) => party.id === partyId) ?? null;

  const supplierStateCode = getDocumentSupplierStateCode(
    config.mode,
    company,
    selectedParty,
  );

  function handleAddItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        id: crypto.randomUUID(),
        productId: "",
        quantity: 1,
        ratePaise: 0,
        discountPaise: 0,
        gstRateBps: 0,
      },
    ]);
  }

  function handleRemoveItem(itemId: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    );
  }

  function handleProductChange(itemId: string, productId: string) {
    const selectedProduct = products.find(
      (product) => product.id === productId,
    );

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId,
              ratePaise: selectedProduct
                ? getDocumentProductRatePaise(selectedProduct, config.mode)
                : 0,
              gstRateBps: selectedProduct?.gst_rate_bps ?? 0,
            }
          : item,
      ),
    );
  }

  function handleQuantityChange(itemId: string, quantity: number) {
    const safeQuantity = Math.max(0, quantity);

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const grossAmountPaise = getGrossPaise(safeQuantity, item.ratePaise);

        return {
          ...item,
          quantity: safeQuantity,
          discountPaise: Math.min(item.discountPaise, grossAmountPaise),
        };
      }),
    );
  }

  function handleRateChange(itemId: string, rateRupees: number) {
    const ratePaise = Math.max(0, Math.round(rateRupees * 100));

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const grossAmountPaise = getGrossPaise(item.quantity, ratePaise);

        return {
          ...item,
          ratePaise,
          discountPaise: Math.min(item.discountPaise, grossAmountPaise),
        };
      }),
    );
  }

  function handleDiscountChange(itemId: string, discountRupees: number) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const grossAmountPaise = getGrossPaise(item.quantity, item.ratePaise);

        const requestedDiscountPaise = Math.max(
          0,
          Math.round(discountRupees * 100),
        );

        return {
          ...item,
          discountPaise: Math.min(requestedDiscountPaise, grossAmountPaise),
        };
      }),
    );
  }

  async function handleSaveDraft() {
    if (isSaving) return;

    setSaveError("");

    if (!documentDate) {
      setSaveError("Please select a document date.");
      return;
    }

    if (!partyId) {
      setSaveError(`Please select a ${config.partyLabel.toLowerCase()}.`);
      return;
    }

    if (!placeOfSupplyStateCode) {
      setSaveError("Please select the place of supply.");
      return;
    }

    if (items.length === 0) {
      setSaveError("Please add at least one product or service.");
      return;
    }

    const invalidItem = items.some((item) => {
      const quantityMilli = getQuantityMilli(item.quantity);
      const grossAmountPaise = getGrossPaise(item.quantity, item.ratePaise);

      return (
        !item.productId ||
        !Number.isFinite(item.quantity) ||
        !Number.isFinite(quantityMilli) ||
        quantityMilli <= 0 ||
        !Number.isFinite(item.ratePaise) ||
        item.ratePaise < 0 ||
        !Number.isFinite(item.discountPaise) ||
        item.discountPaise < 0 ||
        item.discountPaise > grossAmountPaise
      );
    });

    if (invalidItem) {
      setSaveError(
        "Please check every item. Product/service, quantity, rate, and discount must contain valid values.",
      );
      return;
    }

    try {
      const documentItems = items.map((item) => {
        const product = products.find(
          (currentProduct) => currentProduct.id === item.productId,
        );

        if (!product) {
          throw new Error("A selected product could not be found.");
        }

        return {
          product_id: product.id,
          item_name: product.name,
          description: product.description ?? undefined,
          hsn_sac: product.hsn_sac ?? undefined,
          unit: product.unit,
          quantity_milli: getQuantityMilli(item.quantity),
          rate_paise: item.ratePaise,
          discount_paise: item.discountPaise,
          gst_rate_bps: item.gstRateBps,
          cess_rate_bps: product.cess_rate_bps,
        };
      });

      const placeOfSupply = gstStates.find(
        (state) => state.code === placeOfSupplyStateCode,
      );

      setIsSaving(true);

      await createDocument({
        document_type: config.documentType,
        document_date: documentDate,
        party_id: partyId,
        place_of_supply_state: placeOfSupply?.name,
        place_of_supply_state_code: placeOfSupplyStateCode,
        currency_code: "INR",
        items: documentItems,
      });

      notify({
        type: "success",
        title: "Draft saved successfully",
        description:
          "Your document has been saved as a draft. You can review or edit it before issuing.",
      });

      navigate(config.saveRedirectPath);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = (
          error.response?.data as
            | {
                message?: string;
              }
            | undefined
        )?.message;

        setSaveError(
          message ?? "Unable to save the document. Please try again.",
        );
      } else if (error instanceof Error) {
        setSaveError(error.message);
      } else {
        setSaveError("Unable to save the document. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const grossAmountPaise = items.reduce(
    (total, item) => total + getGrossPaise(item.quantity, item.ratePaise),
    0,
  );

  const totalDiscountPaise = items.reduce(
    (total, item) => total + item.discountPaise,
    0,
  );

  const subtotalPaise = items.reduce(
    (total, item) =>
      total +
      getTaxableAmountPaise(item.quantity, item.ratePaise, item.discountPaise),
    0,
  );

  const totalGstPaise = items.reduce((total, item) => {
    const taxableAmountPaise = getTaxableAmountPaise(
      item.quantity,
      item.ratePaise,
      item.discountPaise,
    );

    return total + getGstPaise(taxableAmountPaise, item.gstRateBps);
  }, 0);

  const hasTaxLocation =
    supplierStateCode !== "" && placeOfSupplyStateCode !== "";

  const isInterState =
    hasTaxLocation && supplierStateCode !== placeOfSupplyStateCode;

  const totalCgstPaise =
    hasTaxLocation && !isInterState ? Math.floor(totalGstPaise / 2) : 0;

  const totalSgstPaise =
    hasTaxLocation && !isInterState ? totalGstPaise - totalCgstPaise : 0;

  const totalIgstPaise = hasTaxLocation && isInterState ? totalGstPaise : 0;

  const grandTotalPaise = subtotalPaise + totalGstPaise;

  const activeProducts = products.filter((product) => product.is_active);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate(config.backPath)}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <h1 className="text-2xl font-bold text-slate-900">{config.title}</h1>

        <p className="mt-1 text-sm text-slate-500">{config.description}</p>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Document Details
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Document Number
              </label>

              <input
                type="text"
                placeholder="Auto-generated"
                disabled
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Document Date
              </label>

              <input
                type="date"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {config.partyLabel}
              </label>

              <select
                value={partyId}
                onChange={(event) => setPartyId(event.target.value)}
                disabled={config.isPartiesLoading}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              >
                <option value="" disabled>
                  {config.isPartiesLoading
                    ? `Loading ${config.partyLabel.toLowerCase()}s...`
                    : config.partyLoadError
                      ? `Unable to load ${config.partyLabel.toLowerCase()}s`
                      : config.parties.length === 0
                        ? `No ${config.partyLabel.toLowerCase()}s available`
                        : config.partyPlaceholder}
                </option>

                {config.parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.display_name}
                  </option>
                ))}
              </select>
              {config.partyLoadError && (
                <p className="mt-2 text-sm text-red-600">
                  {config.partyLoadError}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Place of Supply
              </label>

              <select
                value={placeOfSupplyStateCode}
                onChange={(event) =>
                  setPlaceOfSupplyStateCode(event.target.value)
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Select place of supply</option>

                {gstStates.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.code} - {state.name}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                Supplier State Code:{" "}
                {isCompanyLoading
                  ? "Loading..."
                  : supplierStateCode || "Not configured"}
              </p>
              {companyLoadError && (
                <p className="mt-2 text-sm text-red-600">{companyLoadError}</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Items</h2>

              <p className="mt-1 text-sm text-slate-500">
                Add products or services to this document.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex cursor-pointer items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-slate-300 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-600">
                No items added yet
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Add at least one product or service to continue.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="cursor-pointer text-sm font-medium text-red-600 transition hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Product / Service
                  </label>

                  <select
                    value={item.productId}
                    onChange={(event) =>
                      handleProductChange(item.id, event.target.value)
                    }
                    disabled={isProductsLoading}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  >
                    <option value="" disabled>
                      {isProductsLoading
                        ? "Loading products..."
                        : productLoadError
                          ? "Unable to load products and services"
                          : activeProducts.length === 0
                            ? "No products or services available"
                            : "Select product or service"}
                    </option>

                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>

                  {productLoadError && (
                    <p className="mt-2 text-sm text-red-600">
                      {productLoadError}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Quantity
                      </label>

                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.quantity}
                        onChange={(event) =>
                          handleQuantityChange(
                            item.id,
                            Number(event.target.value),
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Rate
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.ratePaise / 100}
                        onChange={(event) =>
                          handleRateChange(item.id, Number(event.target.value))
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Discount
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discountPaise / 100}
                        onChange={(event) =>
                          handleDiscountChange(
                            item.id,
                            Number(event.target.value),
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        GST Rate
                      </label>

                      <input
                        type="text"
                        value={`${(item.gstRateBps / 100).toFixed(2)}%`}
                        readOnly
                        className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-700 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Taxable Amount
                      </label>

                      <input
                        type="text"
                        value={formatMoneyPaise(
                          getTaxableAmountPaise(
                            item.quantity,
                            item.ratePaise,
                            item.discountPaise,
                          ),
                        )}
                        readOnly
                        className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        GST Amount
                      </label>

                      <input
                        type="text"
                        value={formatMoneyPaise(
                          getGstPaise(
                            getTaxableAmountPaise(
                              item.quantity,
                              item.ratePaise,
                              item.discountPaise,
                            ),
                            item.gstRateBps,
                          ),
                        )}
                        readOnly
                        className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Totals</h2>

          <div className="mt-6 ml-auto max-w-sm space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Gross Amount</span>
              <span>{formatMoneyPaise(grossAmountPaise)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>- {formatMoneyPaise(totalDiscountPaise)}</span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3 font-medium text-slate-800">
              <span>Taxable Amount</span>
              <span>{formatMoneyPaise(subtotalPaise)}</span>
            </div>

            {!hasTaxLocation ? (
              <div className="flex justify-between text-slate-600">
                <span>Total GST</span>
                <span>{formatMoneyPaise(totalGstPaise)}</span>
              </div>
            ) : isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>IGST</span>
                <span>{formatMoneyPaise(totalIgstPaise)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST</span>
                  <span>{formatMoneyPaise(totalCgstPaise)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>SGST</span>
                  <span>{formatMoneyPaise(totalSgstPaise)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatMoneyPaise(grandTotalPaise)}</span>
            </div>
          </div>
        </section>

        {saveError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(config.saveRedirectPath)}
            disabled={isSaving}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={isSaving}
            className="inline-flex cursor-pointer items-center justify-center rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <ButtonLoadingContent message="Saving draft..." />
            ) : (
              "Save Draft"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
