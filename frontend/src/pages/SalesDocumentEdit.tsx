import axios from "axios";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { gstStates } from "../constants/gstStates";
import {
  getInvoice,
  updateDocument,
  type InvoiceDetails,
} from "../services/invoiceApi";
import { getCustomers } from "../services/customerApi";
import { getProducts, type Product } from "../services/productApi";
import { getCompany, type Company } from "../services/companyApi";
import { getVendors } from "../services/vendorApi";
import type { DocumentPartyOption } from "../types/documentParty";
import { toDocumentPartyOption } from "../utils/documentParty";
import { getDocumentProductRatePaise } from "../utils/documentProductPrice";
import { getDocumentSupplierStateCode } from "../utils/documentTaxContext";
import {
  getGrossPaise,
  getGstPaise,
  getQuantityMilli,
  getTaxableAmountPaise,
} from "../utils/documentCalculations";
import LoadingState from "../components/LoadingState";
import { useNotification } from "../hooks/useNotifications";
import ButtonLoadingContent from "../components/ButtonLoadingContent";
import SalesInvoiceFields, {
  SalesChargeEditor,
} from "../components/SalesInvoiceFields";
import {
  calculateDocumentPreview,
  dueDateForTerms,
  newSalesEnhancementForm,
  toSalesEnhancementUpdateRequest,
  validateSalesEnhancements,
  type SalesEnhancementForm,
} from "../utils/salesDocumentEnhancements";

type EditableSaleItem = {
  id: string;
  productId: string;
  itemName: string;
  description: string;
  hsnSac: string;
  unit: string;
  quantity: number;
  ratePaise: number;
  discountPaise: number;
  gstRateBps: number;
  cessRateBps: number;
};

function salesEnhancementsFromInvoice(
  invoice: InvoiceDetails,
): SalesEnhancementForm {
  const paymentTermsCode =
    invoice.payment_terms.code ??
    "DUE_ON_RECEIPT";

  return {
    dueDate:
      invoice.due_date ??
      invoice.document_date,

    paymentTermsCode,

    paymentTermsCustom:
      invoice.payment_terms.custom ?? "",

    customerPoNumber:
      invoice.customer_po_number ?? "",

    referenceNumber:
      invoice.reference_number ?? "",

    /*
     * Legacy rows have null here. Treat them as
     * Same as Bill To in the UI without changing
     * the database merely by viewing the document.
     */
    shipToSameAsBillTo:
      invoice.ship_to.same_as_bill_to !== false,

    shipTo: {
      name:
        invoice.ship_to.name ?? "",
      contact_person:
        invoice.ship_to.contact_person ?? "",
      gstin:
        invoice.ship_to.gstin ?? "",
      phone:
        invoice.ship_to.phone ?? "",
      email:
        invoice.ship_to.email ?? "",
      address_line1:
        invoice.ship_to.address_line1 ?? "",
      address_line2:
        invoice.ship_to.address_line2 ?? "",
      city:
        invoice.ship_to.city ?? "",
      state:
        invoice.ship_to.state ?? "",
      state_code:
        invoice.ship_to.state_code ?? "",
      pincode:
        invoice.ship_to.pincode ?? "",
      country:
        invoice.ship_to.country ?? "India",
    },

    additionalChargeLabel:
      invoice.additional_charge.label ?? "",

    additionalChargePaise:
      invoice.additional_charge.amount_paise,

    additionalChargeTaxable:
      invoice.additional_charge.taxable,

    /*
     * -1 is the UI sentinel for "no GST rate selected".
     * Explicit taxable 0% remains a valid 0 value.
     */
    additionalChargeGstRateBps:
      invoice.additional_charge.taxable
        ? invoice.additional_charge.gst_rate_bps
        : -1,
  };
}

export default function SalesDocumentEdit() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { id } = useParams();
  const location = useLocation();

  const isPurchaseRoute = location.pathname.startsWith("/purchases/");

  // const documentMode = isPurchaseRoute ? "PURCHASE" : "SALES";

  const basePath = isPurchaseRoute ? "/purchases" : "/sales";

  // const partyLabel = isPurchaseRoute ? "Vendor" : "Customer";

  const [document, setDocument] = useState<InvoiceDetails | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [documentDate, setDocumentDate] = useState("");

  const [salesEnhancements, setSalesEnhancements] =
    useState<SalesEnhancementForm>(
      () => newSalesEnhancementForm(""),
    );

  const [isSaving, setIsSaving] = useState(false);

  const [saveError, setSaveError] = useState("");

  const [parties, setParties] = useState<DocumentPartyOption[]>([]);
  const [isPartiesLoading, setIsPartiesLoading] = useState(false);
  const [partyLoadError, setPartyLoadError] = useState("");

  const [customerId, setCustomerId] = useState("");

  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState("");

  const [items, setItems] = useState<EditableSaleItem[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productLoadError, setProductLoadError] = useState("");

  const [company, setCompany] = useState<Company | null>(null);
  const [isCompanyLoading, setIsCompanyLoading] = useState(true);
  const [companyLoadError, setCompanyLoadError] = useState("");

  const [notes, setNotes] = useState("");

  const [termsAndConditions, setTermsAndConditions] = useState("");

  useEffect(() => {
    async function loadDocument() {
      if (!id) {
        setError("Document ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await getInvoice(id);

        if (response.status !== "DRAFT") {
          setError("Only draft documents can be edited.");
          return;
        }

        setDocument(response);
        setDocumentDate(response.document_date);

        if (!isPurchaseRoute) {
          setSalesEnhancements(
            salesEnhancementsFromInvoice(response),
          );
        }

        setCustomerId(response.party?.id ?? "");
        setPlaceOfSupplyStateCode(response.place_of_supply.state_code ?? "");
        setItems(
          response.items.map((item) => ({
            id: item.id,
            productId: item.product_id ?? "",
            itemName: item.item_name,
            description: item.description ?? "",
            hsnSac: item.hsn_sac ?? "",
            unit: item.unit ?? "NOS",
            quantity: item.quantity_milli / 1000,
            ratePaise: item.rate_paise,
            discountPaise: item.discount_paise,
            gstRateBps: item.gst_rate_bps,
            cessRateBps: item.cess_rate_bps,
          })),
        );
        setNotes(response.notes ?? "");

        setTermsAndConditions(response.terms_and_conditions ?? "");
      } catch {
        setError("Unable to load the draft document.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDocument();
  }, [id, isPurchaseRoute]);

  useEffect(() => {
    async function loadParties() {
      setIsPartiesLoading(true);
      setPartyLoadError("");

      try {
        if (isPurchaseRoute) {
          const response = await getVendors();

          setParties(
            response
              .filter((vendor) => vendor.is_active === 1)
              .map(toDocumentPartyOption),
          );

          return;
        }

        const response = await getCustomers();

        setParties(
          response
            .filter((customer) => customer.is_active === 1)
            .map(toDocumentPartyOption),
        );
      } catch {
        setParties([]);
        setPartyLoadError(
          isPurchaseRoute
            ? "Unable to load vendors. Please try again."
            : "Unable to load customers. Please try again.",
        );
      } finally {
        setIsPartiesLoading(false);
      }
    }

    void loadParties();
  }, [isPurchaseRoute]);

  useEffect(() => {
    async function loadProducts() {
      setIsProductsLoading(true);
      setProductLoadError("");

      try {
        const response = await getProducts();

        setProducts(response.filter((product) => product.is_active === 1));
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

  function updateItem(id: string, changes: Partial<EditableSaleItem>) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              ...changes,
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        id: crypto.randomUUID(),
        productId: "",
        itemName: "",
        description: "",
        hsnSac: "",
        unit: "NOS",
        quantity: 1,
        ratePaise: 0,
        discountPaise: 0,
        gstRateBps: 0,
        cessRateBps: 0,
      },
    ]);
  }

  function handleDocumentDateChange(
    nextDate: string,
  ) {
    if (!isPurchaseRoute) {
      setSalesEnhancements((current) => {
        const previousAutoDueDate =
          current.paymentTermsCode === "CUSTOM"
            ? ""
            : dueDateForTerms(
                documentDate,
                current.paymentTermsCode,
              );

        const shouldMoveDueDate =
          current.paymentTermsCode !== "CUSTOM" &&
          current.dueDate === previousAutoDueDate;

        return {
          ...current,
          dueDate: shouldMoveDueDate
            ? dueDateForTerms(
                nextDate,
                current.paymentTermsCode,
              )
            : current.dueDate,
        };
      });
    }

    setDocumentDate(nextDate);
  }

  const selectedActiveParty =
    parties.find((party) => party.id === customerId) ?? null;

  const documentPartyStateCode =
    document?.party?.addresses?.find((address) => address.is_default === 1)
      ?.state_code ??
    document?.party?.addresses?.[0]?.state_code ??
    document?.party?.gstin?.slice(0, 2) ??
    null;

  const selectedParty: DocumentPartyOption | null =
    selectedActiveParty ??
    (document?.party?.id === customerId
      ? {
          id: document.party.id,
          display_name:
            document.party.display_name ??
            (isPurchaseRoute ? "Inactive Vendor" : "Inactive Customer"),
          legal_name:
            document.party.legal_name,
          gstin:
            document.party.gstin,
          email:
            document.party.email,
          phone:
            document.party.phone,
          addresses:
            document.party.addresses,
          state_code:
            documentPartyStateCode,
        }
      : null);

  const liveTotals = items.reduce(
    (totals, item) => {
      const grossPaise =
        getGrossPaise(
          item.quantity,
          item.ratePaise,
        );

      const taxablePaise =
        getTaxableAmountPaise(
          item.quantity,
          item.ratePaise,
          item.discountPaise,
        );

      const discountPaise =
        grossPaise - taxablePaise;

      const gstPaise =
        getGstPaise(
          taxablePaise,
          item.gstRateBps,
        );

      const cessPaise =
        Math.floor(
          (taxablePaise *
            item.cessRateBps) /
            10000,
        );

      totals.grossPaise += grossPaise;
      totals.discountPaise += discountPaise;
      totals.taxablePaise += taxablePaise;
      totals.gstPaise += gstPaise;
      totals.cessPaise += cessPaise;

      return totals;
    },
    {
      grossPaise: 0,
      discountPaise: 0,
      taxablePaise: 0,
      gstPaise: 0,
      cessPaise: 0,
    },
  );

  const supplierStateCode =
    getDocumentSupplierStateCode(
      isPurchaseRoute
        ? "PURCHASE"
        : "SALES",
      company,
      selectedParty,
    );

  const hasTaxLocation =
    supplierStateCode !== "" &&
    placeOfSupplyStateCode !== "";

  const isInterState =
    hasTaxLocation &&
    supplierStateCode !==
      placeOfSupplyStateCode;

  const isIntraState =
    hasTaxLocation &&
    !isInterState;

  const liveCgstPaise =
    hasTaxLocation && !isInterState
      ? Math.floor(
          liveTotals.gstPaise / 2,
        )
      : 0;

  const liveSgstPaise =
    hasTaxLocation && !isInterState
      ? liveTotals.gstPaise -
        liveCgstPaise
      : 0;

  const liveIgstPaise =
    hasTaxLocation && isInterState
      ? liveTotals.gstPaise
      : 0;

  const liveGrandTotalPaise =
    liveTotals.taxablePaise +
    liveTotals.gstPaise +
    liveTotals.cessPaise;

  const salesPreview =
    !isPurchaseRoute
      ? calculateDocumentPreview(
          items.map((item) => ({
            quantity:
              item.quantity,
            ratePaise:
              item.ratePaise,
            discountPaise:
              item.discountPaise,
            gstRateBps:
              item.gstRateBps,
            cessRateBps:
              item.cessRateBps,
          })),
          isIntraState,
          salesEnhancements,
        )
      : null;

  const displayGrossPaise =
    salesPreview?.grossPaise ??
    liveTotals.grossPaise;

  const displayDiscountPaise =
    salesPreview?.discountPaise ??
    liveTotals.discountPaise;

  const displayTaxablePaise =
    salesPreview?.taxablePaise ??
    liveTotals.taxablePaise;

  const displayGstPaise =
    salesPreview?.gstPaise ??
    liveTotals.gstPaise;

  const displayCgstPaise =
    salesPreview?.cgstPaise ??
    liveCgstPaise;

  const displaySgstPaise =
    salesPreview?.sgstPaise ??
    liveSgstPaise;

  const displayIgstPaise =
    salesPreview?.igstPaise ??
    liveIgstPaise;

  const displayCessPaise =
    salesPreview?.cessPaise ??
    liveTotals.cessPaise;

  const displayAdditionalChargePaise =
    salesPreview?.additionalChargePaise ??
    0;

  const displayGrandTotalPaise =
    salesPreview?.totalPaise ??
    liveGrandTotalPaise;

  async function handleSave() {
    if (isSaving) return;

    setSaveError("");

    if (!id || !document || document.status !== "DRAFT") {
      setSaveError("Only draft documents can be edited.");
      return;
    }

    if (!documentDate) {
      setSaveError("Document Date is required.");
      return;
    }

    if (!customerId) {
      setSaveError(
        isPurchaseRoute
          ? "Please select a vendor."
          : "Please select a customer.",
      );
      return;
    }

    if (!placeOfSupplyStateCode) {
      setSaveError("Please select a Place of Supply.");
      return;
    }

    if (!isPurchaseRoute) {
      const enhancementError =
        validateSalesEnhancements(
          salesEnhancements,
          documentDate,
        );

      if (enhancementError) {
        setSaveError(
          enhancementError,
        );
        return;
      }
    }

    if (items.length === 0) {
      setSaveError("At least one item is required.");
      return;
    }

    const hasInvalidItem = items.some((item) => {
      const quantityMilli = getQuantityMilli(item.quantity);
      const grossPaise = getGrossPaise(item.quantity, item.ratePaise);

      return (
        !item.itemName.trim() ||
        !Number.isFinite(item.quantity) ||
        !Number.isFinite(quantityMilli) ||
        quantityMilli <= 0 ||
        !Number.isFinite(item.ratePaise) ||
        item.ratePaise < 0 ||
        !Number.isFinite(item.discountPaise) ||
        item.discountPaise < 0 ||
        item.discountPaise > grossPaise
      );
    });

    if (hasInvalidItem) {
      setSaveError(
        "Please check every item. Name, quantity, rate, and discount must contain valid values.",
      );
      return;
    }

    const placeOfSupply = gstStates.find(
      (state) => state.code === placeOfSupplyStateCode,
    );

    if (!placeOfSupply) {
      setSaveError("Please select a valid Place of Supply.");
      return;
    }

    const documentItems = items.map((item) => {
      const quantityMilli = getQuantityMilli(item.quantity);

      const grossPaise = getGrossPaise(item.quantity, item.ratePaise);

      const discountPaise = Math.min(
        Math.max(0, item.discountPaise),
        grossPaise,
      );

      return {
        product_id: item.productId || null,
        item_name: item.itemName,
        description: item.description || undefined,
        hsn_sac: item.hsnSac || undefined,
        unit: item.unit || "NOS",
        quantity_milli: quantityMilli,
        rate_paise: item.ratePaise,
        discount_paise: discountPaise,
        gst_rate_bps: item.gstRateBps,
        cess_rate_bps: item.cessRateBps,
      };
    });

    setIsSaving(true);

    try {
      await updateDocument(id, {
        document_date:
          documentDate,

        party_id:
          customerId,

        place_of_supply_state:
          placeOfSupply.name,

        place_of_supply_state_code:
          placeOfSupply.code,

        items:
          documentItems,

        notes:
          notes.trim() || null,

        terms_and_conditions:
          termsAndConditions.trim() || null,

        ...(
          isPurchaseRoute
            ? {}
            : {
                due_date:
                  salesEnhancements.dueDate ||
                  null,

                reference_number:
                  salesEnhancements
                    .referenceNumber
                    .trim() ||
                  null,

                ...toSalesEnhancementUpdateRequest(
                  salesEnhancements,
                ),
              }
        ),
      });

      notify({
        type: "success",
        title: "Draft updated successfully",
        description: `${document.document_number} has been saved. You can review it before issuing.`,
      });

      navigate(`${basePath}/${id}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = (
          error.response?.data as
            | {
                message?: string;
              }
            | undefined
        )?.message;

        setSaveError(message ?? "Unable to save the draft. Please try again.");
      } else if (error instanceof Error) {
        setSaveError(error.message);
      } else {
        setSaveError("Unable to save the draft. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <LoadingState
          message="Loading draft..."
          description="Fetching the document details for editing."
        />
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate(id ? `${basePath}/${id}` : basePath)}
          className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Draft document not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <button
        type="button"
        onClick={() => navigate(`${basePath}/${document.id}`)}
        disabled={isSaving}
        className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to Document
      </button>

      <h1 className="text-2xl font-bold text-slate-900">Edit Draft</h1>

      <p className="mt-2 text-sm text-slate-500">{document.document_number}</p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Document Details
        </h2>

        <div className="mt-6 max-w-md">
          <label
            htmlFor="document-date"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Document Date
          </label>

          <input
            id="document-date"
            type="date"
            value={documentDate}
            onChange={(event) =>
              handleDocumentDateChange(
                event.target.value,
              )
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          />

          <div className="mt-5">
            <label
              htmlFor="party"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              {isPurchaseRoute ? "Vendor" : "Customer"}
            </label>

            <select
              id="party"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              disabled={isPartiesLoading}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">
                {isPartiesLoading
                  ? isPurchaseRoute
                    ? "Loading vendors..."
                    : "Loading customers..."
                  : partyLoadError
                    ? isPurchaseRoute
                      ? "Unable to load vendors"
                      : "Unable to load customers"
                    : parties.length === 0
                      ? isPurchaseRoute
                        ? "No vendors available"
                        : "No customers available"
                      : isPurchaseRoute
                        ? "Select vendor"
                        : "Select customer"}
              </option>

              {customerId &&
                document.party?.id === customerId &&
                !parties.some((party) => party.id === customerId) &&
                !isPartiesLoading &&
                !partyLoadError && (
                  <option value={customerId} disabled>
                    {document.party.display_name} (Inactive)
                  </option>
                )}

              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.display_name}
                </option>
              ))}
            </select>
            {partyLoadError && (
              <p className="mt-2 text-sm text-red-600">{partyLoadError}</p>
            )}
          </div>

          <div className="mt-5">
            <label
              htmlFor="place-of-supply"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Place of Supply
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Supplier State Code:{" "}
              {!isPurchaseRoute && isCompanyLoading
                ? "Loading..."
                : supplierStateCode || "Not configured"}
            </p>

            {!isPurchaseRoute && companyLoadError && (
              <p className="mt-2 text-sm text-red-600">{companyLoadError}</p>
            )}

            <select
              id="place-of-supply"
              value={placeOfSupplyStateCode}
              onChange={(event) =>
                setPlaceOfSupplyStateCode(event.target.value)
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">Select state</option>

              {gstStates.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code} - {state.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isPurchaseRoute && (
          <div className="mt-6 space-y-6">
            <SalesInvoiceFields
              value={salesEnhancements}
              onChange={
                setSalesEnhancements
              }
              documentDate={
                documentDate
              }
              billTo={
                selectedParty
              }
            />
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Items</h2>

            <button
              type="button"
              onClick={addItem}
              className="cursor-pointer rounded-md bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200"
            >
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Item
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Qty
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rate
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Discount
                  </th>

                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Taxable
                  </th>

                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    GST
                  </th>

                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const grossPaise = getGrossPaise(
                    item.quantity,
                    item.ratePaise,
                  );

                  const taxablePaise = getTaxableAmountPaise(
                    item.quantity,
                    item.ratePaise,
                    item.discountPaise,
                  );

                  const gstPaise = getGstPaise(taxablePaise, item.gstRateBps);

                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-4">
                        <select
                          value={item.productId}
                          onChange={(event) => {
                            const productId = event.target.value;

                            const product = products.find(
                              (candidate) => candidate.id === productId,
                            );

                            if (!product) {
                              updateItem(item.id, {
                                productId: "",
                                itemName: "",
                                description: "",
                                hsnSac: "",
                                unit: "NOS",
                                ratePaise: 0,
                                discountPaise: 0,
                                gstRateBps: 0,
                                cessRateBps: 0,
                              });

                              return;
                            }

                            updateItem(item.id, {
                              productId: product.id,
                              itemName: product.name,
                              description: product.description ?? "",
                              hsnSac: product.hsn_sac ?? "",
                              unit: product.unit || "NOS",
                              ratePaise: getDocumentProductRatePaise(
                                product,
                                isPurchaseRoute ? "PURCHASE" : "SALES",
                              ),
                              discountPaise: 0,
                              gstRateBps: product.gst_rate_bps,
                              cessRateBps: product.cess_rate_bps,
                            });
                          }}
                          disabled={isProductsLoading}
                          className="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                        >
                          <option value="">
                            {isProductsLoading
                              ? "Loading products..."
                              : productLoadError
                                ? "Unable to load products and services"
                                : products.length === 0
                                  ? "No products or services available"
                                  : "Select product / service"}
                          </option>

                          {item.productId &&
                            !products.some(
                              (product) => product.id === item.productId,
                            ) &&
                            !isProductsLoading &&
                            !productLoadError && (
                              <option value={item.productId} disabled>
                                {item.itemName} (Inactive)
                              </option>
                            )}

                          {products.map((product) => (
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

                        {item.productId && (
                          <p className="mt-2 text-xs text-slate-500">
                            {item.hsnSac
                              ? `HSN/SAC: ${item.hsnSac}`
                              : "HSN/SAC: -"}
                            {" · "}
                            {item.unit}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={(event) => {
                            const quantity = Number(event.target.value);

                            updateItem(item.id, {
                              quantity: Number.isFinite(quantity)
                                ? quantity
                                : 0,
                            });
                          }}
                          className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.ratePaise / 100}
                          onChange={(event) => {
                            const value = Number(event.target.value);

                            updateItem(item.id, {
                              ratePaise: Math.max(0, Math.round(value * 100)),
                            });
                          }}
                          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discountPaise / 100}
                          onChange={(event) => {
                            const value = Number(event.target.value);

                            updateItem(item.id, {
                              discountPaise: Math.min(
                                Math.max(0, Math.round(value * 100)),
                                grossPaise,
                              ),
                            });
                          }}
                          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-600">
                        ₹{(taxablePaise / 100).toFixed(2)}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-600">
                        ₹{(gstPaise / 100).toFixed(2)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setItems((currentItems) =>
                              currentItems.filter(
                                (currentItem) => currentItem.id !== item.id,
                              ),
                            )
                          }
                          disabled={items.length === 1}
                          className="cursor-pointer text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Additional Details
          </h2>

          <div className="mt-6 space-y-5">

            {!isPurchaseRoute && (
              <SalesChargeEditor
                value={salesEnhancements}
                onChange={
                  setSalesEnhancements
                }
              />
            )}
            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                {isPurchaseRoute ? "Notes" : "Customer Notes"}
              </label>

              <textarea
                id="notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={
                  isPurchaseRoute
                    ? "Add notes for the vendor..."
                    : "Add notes for the customer..."
                }
                className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="terms-and-conditions"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Terms & Conditions
              </label>

              <textarea
                id="terms-and-conditions"
                rows={5}
                value={termsAndConditions}
                onChange={(event) => setTermsAndConditions(event.target.value)}
                placeholder="Enter payment terms, validity, delivery terms, etc."
                className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Totals</h2>

          <div className="mt-6 ml-auto max-w-sm space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Gross Amount</span>

              <span>₹{(displayGrossPaise / 100).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Discount</span>

              <span>- ₹{(displayDiscountPaise / 100).toFixed(2)}</span>
            </div>

            {!isPurchaseRoute &&
              displayAdditionalChargePaise > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    {salesEnhancements.additionalChargeLabel.trim() ||
                      "Additional Charge"}
                  </span>

                  <span>
                    ₹{(
                      displayAdditionalChargePaise /
                      100
                    ).toFixed(2)}
                  </span>
                </div>
              )}

            <div className="flex justify-between border-t border-slate-200 pt-3 text-slate-700">
              <span>Taxable Amount</span>

              <span>₹{(displayTaxablePaise / 100).toFixed(2)}</span>
            </div>

            {!hasTaxLocation ? (
              <div className="flex justify-between text-slate-600">
                <span>Total GST</span>

                <span>₹{(displayGstPaise / 100).toFixed(2)}</span>
              </div>
            ) : isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>IGST</span>

                <span>₹{(displayIgstPaise / 100).toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST</span>

                  <span>₹{(displayCgstPaise / 100).toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>SGST</span>

                  <span>₹{(displaySgstPaise / 100).toFixed(2)}</span>
                </div>
              </>
            )}

            {displayCessPaise > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Cess</span>

                <span>₹{(displayCessPaise / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total</span>

              <span>₹{(displayGrandTotalPaise / 100).toFixed(2)}</span>
            </div>
          </div>
        </section>

        {saveError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="cursor-pointer rounded-md bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <ButtonLoadingContent message="Saving changes..." />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
