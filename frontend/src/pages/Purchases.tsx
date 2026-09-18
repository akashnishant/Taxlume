import DocumentListPage from "../components/DocumentListPage";

const PURCHASE_DOCUMENT_TYPES = ["PURCHASE_ORDER"];

export default function Purchases() {
  return (
    <DocumentListPage
      title="Purchases"
      description="Create and manage your purchase documents."
      newButtonLabel="New Purchase Order"
      newPath="/purchases/new"
      detailsBasePath="/purchases"
      allowedDocumentTypes={PURCHASE_DOCUMENT_TYPES}
    />
  );
}
