import DocumentListPage from "../components/DocumentListPage";

const SALES_DOCUMENT_TYPES = [
  "TAX_INVOICE",
  "PROFORMA_INVOICE",
  "QUOTATION",
  "DELIVERY_CHALLAN",
];

export default function Sales() {
  return (
    <DocumentListPage
      title="Sales"
      description="Create and manage your sales documents."
      newButtonLabel="New Sale"
      newPath="/sales/new"
      detailsBasePath="/sales"
      allowedDocumentTypes={SALES_DOCUMENT_TYPES}
    />
  );
}
