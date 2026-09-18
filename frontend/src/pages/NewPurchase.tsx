import { useEffect, useState } from "react";

import DocumentEntryForm from "../components/DocumentEntryForm";
import { getVendors } from "../services/vendorApi";
import type { DocumentPartyOption } from "../types/documentParty";
import { toDocumentPartyOption } from "../utils/documentParty";

export default function NewPurchase() {
  const [vendors, setVendors] = useState<DocumentPartyOption[]>([]);

  const [isVendorsLoading, setIsVendorsLoading] = useState(true);

  const [vendorLoadError, setVendorLoadError] = useState("");

  useEffect(() => {
    async function loadVendors() {
      setIsVendorsLoading(true);
      setVendorLoadError("");

      try {
        const response = await getVendors();

        setVendors(
          response
            .filter((vendor) => vendor.is_active)
            .map(toDocumentPartyOption),
        );
      } catch {
        setVendors([]);
        setVendorLoadError("Unable to load vendors. Please try again.");
      } finally {
        setIsVendorsLoading(false);
      }
    }

    void loadVendors();
  }, []);

  return (
    <DocumentEntryForm
      config={{
        mode: "PURCHASE",
        title: "New Purchase Order",
        description: "Create a new purchase order for a vendor.",
        partyLabel: "Vendor",
        partyPlaceholder: "Select vendor",
        backPath: "/purchases",
        saveRedirectPath: "/purchases",
        documentType: "PURCHASE_ORDER",
        parties: vendors,
        isPartiesLoading: isVendorsLoading,
        partyLoadError: vendorLoadError,
      }}
    />
  );
}
