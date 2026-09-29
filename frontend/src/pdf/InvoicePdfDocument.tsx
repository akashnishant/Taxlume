import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { InvoiceDetails } from "../services/invoiceApi";

type PdfCompanyDetails = {
  legal_name: string;
  trade_name: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
};

type PdfPaymentDetails = {
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  upi_id: string | null;
  show_qr_on_invoice: boolean;
};

type InvoicePdfDocumentProps = {
  company: PdfCompanyDetails;
  document: InvoiceDetails;
  paymentDetails: PdfPaymentDetails;
  paymentQrDataUrl: string | null;
  signatureDataUrl: string | null;
};

const styles = StyleSheet.create({
  // Compact commercial layout. The invoice keeps all configured information,
  // but uses space more efficiently so typical 10-12 item invoices can stay
  // on one A4 page. Longer addresses/notes still paginate normally.
  page: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    fontSize: 7.2,
    fontFamily: "Helvetica",
    color: "#111827",
    lineHeight: 1.2,
  },

  watermark: {
    position: "absolute",
    top: "42%",
    left: "18%",
    fontSize: 58,
    fontWeight: 700,
    color: "#e5e7eb",
    transform: "rotate(-35deg)",
    opacity: 0.48,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },

  companyBlock: {
    width: "60%",
  },

  documentHeadingBlock: {
    width: "38%",
    alignItems: "flex-end",
  },

  companyName: {
    fontSize: 12.5,
    fontWeight: 700,
    marginBottom: 3,
  },

  companyLegalName: {
    fontSize: 7.2,
    marginBottom: 1,
  },

  companyAddressStart: {
    // Keep the identity block visually separate from the address/contact lines.
    marginTop: 2.5,
  },

  smallText: {
    fontSize: 6.8,
    lineHeight: 1.18,
  },

  muted: {
    // Slightly stronger contrast keeps secondary information comfortable to read.
    color: "#4b5563",
  },

  documentTitle: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: "right",
    lineHeight: 1.15,
  },

  documentNumber: {
    marginTop: 3,
    fontSize: 7.2,
    fontWeight: 700,
    textAlign: "right",
  },

  divider: {
    borderBottomWidth: 0.8,
    borderBottomColor: "#cbd5e1",
    marginBottom: 5,
  },

  shipToBox: {
    borderWidth: 0.8,
    borderColor: "#d1d5db",
    padding: 5,
    marginBottom: 5,
  },

  shipSameRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 0.6,
    borderTopColor: "#e5e7eb",
    marginTop: 3,
    paddingTop: 3,
  },

  shipSameLabel: {
    fontSize: 6.2,
    fontWeight: 700,
    marginRight: 5,
  },

  shipSameValue: {
    fontSize: 6.4,
    color: "#4b5563",
  },

  chargeLabel: {
    width: "60%",
    paddingRight: 4,
  },

  infoGrid: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: "#d1d5db",
    marginBottom: 5,
  },

  infoColumn: {
    width: "50%",
    padding: 5,
  },

  infoColumnRight: {
    width: "50%",
    padding: 5,
    borderLeftWidth: 0.8,
    borderLeftColor: "#d1d5db",
  },

  sectionTitle: {
    fontSize: 7.2,
    fontWeight: 700,
    marginBottom: 2.5,
    textTransform: "uppercase",
  },

  partyName: {
    fontSize: 7.4,
    fontWeight: 700,
    marginBottom: 1,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },

  detailLabel: {
    width: "42%",
    color: "#6b7280",
  },

  detailValue: {
    width: "58%",
    textAlign: "right",
  },

  table: {
    // Keep the column header visually separate from the bordered item body.
    // Only the rows area receives an outer border; the header itself remains
    // borderless and uses its background fill for hierarchy.
    marginBottom: 5,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eef2f7",
    fontWeight: 700,
    fontSize: 6.8,
    color: "#111827",
  },

  tableBody: {
    borderWidth: 0.7,
    borderColor: "#cbd5e1",
    // Preserve approximately the same total Items-section footprint as the
    // previous 250pt table: header (~13pt) + body (~237pt). The body can grow
    // naturally for longer invoices, so no content is clipped.
    minHeight: 237,
  },

  tableRow: {
    flexDirection: "row",
  },

  tableRowAlt: {
    backgroundColor: "#f7f8fa",
  },

  tableRowLast: {
    flexDirection: "row",
  },

  cell: {
    paddingVertical: 2.45,
    paddingHorizontal: 2.4,
  },

  itemCell: {
    width: "25%",
  },

  qtyCell: {
    width: "7%",
    textAlign: "right",
  },

  rateCell: {
    width: "13%",
    textAlign: "right",
  },

  discountCell: {
    width: "12%",
    textAlign: "right",
  },

  taxableCell: {
    width: "14%",
    textAlign: "right",
  },

  gstCell: {
    width: "12%",
    textAlign: "right",
  },

  totalCell: {
    width: "17%",
    textAlign: "right",
  },

  itemName: {
    fontSize: 7.1,
    fontWeight: 700,
  },

  itemMeta: {
    marginTop: 0.6,
    fontSize: 6.05,
    lineHeight: 1.15,
    color: "#4b5563",
  },

  summaryGrid: {
    flexDirection: "row",
    marginBottom: 5,
  },

  amountWordsBlock: {
    width: "50%",
    paddingRight: 8,
  },

  totalsBlock: {
    width: "50%",
    borderWidth: 0.8,
    borderColor: "#d1d5db",
    padding: 4.5,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1.5,
  },

  totalDivider: {
    borderTopWidth: 0.7,
    borderTopColor: "#d1d5db",
    paddingTop: 2.5,
    marginTop: 1.2,
  },

  grandTotal: {
    fontSize: 8.2,
    fontWeight: 700,
  },

  notesTermsGrid: {
    flexDirection: "row",
    marginBottom: 5,
  },

  notesColumn: {
    width: "50%",
    paddingRight: 6,
  },

  termsColumn: {
    width: "50%",
    paddingLeft: 6,
    borderLeftWidth: 0.6,
    borderLeftColor: "#e5e7eb",
  },

  textBlock: {
    fontSize: 6.4,
    lineHeight: 1.2,
    color: "#374151",
  },

  footerBox: {
    flexDirection: "row",
    borderWidth: 0.8,
    borderColor: "#d1d5db",
    minHeight: 54,
    marginTop: "auto",
  },

  bankBlock: {
    width: "48%",
    padding: 5,
  },

  bankBlockNoQr: {
    width: "58%",
  },

  qrBlock: {
    width: "18%",
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 0.8,
    borderLeftColor: "#d1d5db",
  },

  signatoryBlock: {
    width: "34%",
    padding: 5,
    borderLeftWidth: 0.8,
    borderLeftColor: "#d1d5db",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  signatoryBlockNoQr: {
    width: "42%",
  },

  footerBoxPurchaseOrder: {
    borderWidth: 0,
    justifyContent: "flex-end",
  },

  signatoryBlockPurchaseOrder: {
    width: "34%",
    borderWidth: 0.8,
    borderColor: "#d1d5db",
  },

  qrImage: {
    width: 40,
    height: 40,
    objectFit: "contain",
  },

  qrLabel: {
    marginTop: 1,
    fontSize: 5.5,
    color: "#6b7280",
    textAlign: "center",
  },

  signatureImage: {
    width: 72,
    height: 25,
    objectFit: "contain",
    marginVertical: 2,
  },

  signatoryCompany: {
    fontSize: 6.4,
    fontWeight: 700,
    textAlign: "right",
  },

  signatoryLabel: {
    fontSize: 6.4,
    fontWeight: 700,
    textAlign: "right",
  },

  pageNumber: {
    position: "absolute",
    bottom: 6,
    left: 20,
    right: 20,
    textAlign: "center",
    fontSize: 5.8,
    color: "#9ca3af",
  },
});

function formatDocumentType(documentType: string): string {
  switch (documentType) {
    case "TAX_INVOICE":
      return "TAX INVOICE";

    case "PROFORMA_INVOICE":
      return "PROFORMA INVOICE";

    case "QUOTATION":
      return "QUOTATION";

    case "DELIVERY_CHALLAN":
      return "DELIVERY CHALLAN";

    case "PURCHASE_ORDER":
      return "PURCHASE ORDER";

    default:
      return documentType.replaceAll("_", " ");
  }
}

function formatMoney(valuePaise: number, currencyCode: string): string {
  const currencyLabel = currencyCode === "INR" ? "Rs" : currencyCode;

  return `${currencyLabel} ${(valuePaise / 100).toFixed(2)}`;
}

function formatTableMoney(valuePaise: number): string {
  return (valuePaise / 100).toFixed(2);
}

function formatDate(date: string | null): string {
  if (!date) {
    return "-";
  }

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${day}-${month}-${year}`;
}

function formatPaymentTerms(
  code: string | null,
  custom: string | null,
): string {
  switch (code) {
    case "DUE_ON_RECEIPT":
      return "Due on Receipt";
    case "NET_7":
      return "Net 7";
    case "NET_15":
      return "Net 15";
    case "NET_30":
      return "Net 30";
    case "NET_45":
      return "Net 45";
    case "NET_60":
      return "Net 60";
    case "CUSTOM":
      return custom?.trim() || "Custom";
    default:
      return "-";
  }
}

function getPartyAddress(document: InvoiceDetails) {
  if (!document.party?.addresses.length) {
    return null;
  }

  return (
    document.party.addresses.find((address) => address.is_default === 1) ??
    document.party.addresses[0]
  );
}

function numberToWords(value: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function belowThousand(number: number): string {
    let result = "";

    if (number >= 100) {
      result += `${ones[Math.floor(number / 100)]} Hundred `;

      number %= 100;
    }

    if (number >= 20) {
      result += `${tens[Math.floor(number / 10)]} `;

      number %= 10;
    }

    if (number > 0) {
      result += `${ones[number]} `;
    }

    return result.trim();
  }

  if (value === 0) {
    return "Zero";
  }

  const parts: string[] = [];

  const crore = Math.floor(value / 10000000);

  value %= 10000000;

  const lakh = Math.floor(value / 100000);

  value %= 100000;

  const thousand = Math.floor(value / 1000);

  value %= 1000;

  if (crore > 0) {
    parts.push(`${belowThousand(crore)} Crore`);
  }

  if (lakh > 0) {
    parts.push(`${belowThousand(lakh)} Lakh`);
  }

  if (thousand > 0) {
    parts.push(`${belowThousand(thousand)} Thousand`);
  }

  if (value > 0) {
    parts.push(belowThousand(value));
  }

  return parts.join(" ");
}

function formatAmountInWords(valuePaise: number): string {
  const rupees = Math.floor(valuePaise / 100);

  const paise = valuePaise % 100;

  let result = `${numberToWords(rupees)} Rupees`;

  if (paise > 0) {
    result += ` and ${numberToWords(paise)} Paise`;
  }

  return `${result} Only`;
}

export default function InvoicePdfDocument({
  company,
  document,
  paymentDetails,
  paymentQrDataUrl,
  signatureDataUrl,
}: InvoicePdfDocumentProps) {
  const partyAddress = getPartyAddress(document);
  const isPurchaseOrder = document.document_type === "PURCHASE_ORDER";

  // Legacy NULL shipping mode means Same as Bill To.
  const shipToSameAsBillTo =
    document.ship_to.same_as_bill_to !== false;

  const balanceDuePaise = Math.max(
    0,
    document.totals.total_paise -
      document.totals.amount_paid_paise,
  );

  const showPaymentQr =
    !isPurchaseOrder &&
    paymentDetails.show_qr_on_invoice &&
    Boolean(paymentQrDataUrl);

  const tableCurrencyLabel =
    document.currency_code === "INR" ? "Rs" : document.currency_code;

  const hasPaymentDetails = Boolean(
    paymentDetails.bank_name ||
      paymentDetails.account_holder_name ||
      paymentDetails.account_number ||
      paymentDetails.ifsc_code ||
      paymentDetails.branch_name ||
      paymentDetails.upi_id,
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {document.status === "DRAFT" && (
          <Text style={styles.watermark} fixed>
            DRAFT
          </Text>
        )}

        {document.status === "CANCELLED" && (
          <Text style={styles.watermark} fixed>
            CANCELLED
          </Text>
        )}

        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>
              {company.trade_name || company.legal_name}
            </Text>

            {company.trade_name && (
              <Text style={styles.companyLegalName}>{company.legal_name}</Text>
            )}

            <Text style={[styles.smallText, styles.companyAddressStart]}>
              {[company.address_line1, company.address_line2]
                .filter(Boolean)
                .join(", ")}
            </Text>

            <Text style={styles.smallText}>
              {[company.city, company.state, company.pincode, company.country]
                .filter(Boolean)
                .join(", ")}
            </Text>

            <Text style={styles.smallText}>
              {[
                company.gstin ? `GSTIN: ${company.gstin}` : null,
                company.pan ? `PAN: ${company.pan}` : null,
              ]
                .filter(Boolean)
                .join("  |  ")}
            </Text>

            <Text style={styles.smallText}>
              {[company.phone, company.email].filter(Boolean).join("  |  ")}
            </Text>
          </View>

          <View style={styles.documentHeadingBlock}>
            <Text style={styles.documentTitle}>
              {formatDocumentType(document.document_type)}
            </Text>

            <Text style={styles.documentNumber}>
              {document.document_number}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <View style={styles.infoColumn}>
            <Text style={styles.sectionTitle}>
              {isPurchaseOrder ? "Vendor / Supplier" : "Bill To"}
            </Text>

            <Text style={styles.partyName}>
              {document.party?.display_name ||
                document.party?.legal_name ||
                "-"}
            </Text>

            {document.party?.legal_name &&
              document.party.legal_name !== document.party.display_name && (
                <Text style={styles.smallText}>
                  {document.party.legal_name}
                </Text>
              )}

            {partyAddress && (
              <>
                <Text style={styles.smallText}>
                  {[partyAddress.address_line1, partyAddress.address_line2]
                    .filter(Boolean)
                    .join(", ")}
                </Text>

                <Text style={styles.smallText}>
                  {[
                    partyAddress.city,
                    partyAddress.state,
                    partyAddress.pincode,
                    partyAddress.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </>
            )}

            <Text style={styles.smallText}>
              {[
                document.party?.gstin ? `GSTIN: ${document.party.gstin}` : null,
                document.party?.pan ? `PAN: ${document.party.pan}` : null,
              ]
                .filter(Boolean)
                .join("  |  ")}
            </Text>

            <Text style={styles.smallText}>
              {[document.party?.phone, document.party?.email]
                .filter(Boolean)
                .join("  |  ")}
            </Text>

            {!isPurchaseOrder && shipToSameAsBillTo && (
              <View style={styles.shipSameRow}>
                <Text style={styles.shipSameLabel}>SHIP TO</Text>
                <Text style={styles.shipSameValue}>Same as Bill To</Text>
              </View>
            )}
          </View>

          <View style={styles.infoColumnRight}>
            <Text style={styles.sectionTitle}>
              {isPurchaseOrder ? "Purchase Order Details" : "Invoice Details"}
            </Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>

              <Text style={styles.detailValue}>
                {formatDate(document.document_date)}
              </Text>
            </View>

            {(document.due_date || !isPurchaseOrder) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Due Date</Text>

                <Text style={styles.detailValue}>
                  {formatDate(document.due_date)}
                </Text>
              </View>
            )}

            {!isPurchaseOrder && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Terms</Text>

                  <Text style={styles.detailValue}>
                    {formatPaymentTerms(
                      document.payment_terms.code,
                      document.payment_terms.custom,
                    )}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer PO</Text>

                  <Text style={styles.detailValue}>
                    {document.customer_po_number || "-"}
                  </Text>
                </View>

                {document.e_way_bill_number && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>E-Way Bill No.</Text>

                    <Text style={styles.detailValue}>
                      {document.e_way_bill_number}
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Place of Supply</Text>

              <Text style={styles.detailValue}>
                {document.place_of_supply.state_code
                  ? `${document.place_of_supply.state_code} - `
                  : ""}
                {document.place_of_supply.state ?? "-"}
              </Text>
            </View>

            {(document.reference_number || !isPurchaseOrder) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reference</Text>

                <Text style={styles.detailValue}>
                  {document.reference_number || "-"}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>

              <Text style={styles.detailValue}>{document.status}</Text>
            </View>
          </View>
        </View>

        {!isPurchaseOrder && !shipToSameAsBillTo && (
          <View style={styles.shipToBox}>
            <Text style={styles.sectionTitle}>Ship To</Text>

            <Text style={styles.partyName}>
              {document.ship_to.name || "-"}
            </Text>

            {document.ship_to.contact_person && (
              <Text style={styles.smallText}>
                Contact: {document.ship_to.contact_person}
              </Text>
            )}

            <Text style={styles.smallText}>
              {[
                document.ship_to.address_line1,
                document.ship_to.address_line2,
              ]
                .filter(Boolean)
                .join(", ") || "-"}
            </Text>

            <Text style={styles.smallText}>
              {[
                document.ship_to.city,
                document.ship_to.state,
                document.ship_to.pincode,
                document.ship_to.country,
              ]
                .filter(Boolean)
                .join(", ") || "-"}
            </Text>

            <Text style={styles.smallText}>
              GSTIN: {document.ship_to.gstin || "-"}
            </Text>

            <Text style={styles.smallText}>
              {[document.ship_to.phone, document.ship_to.email]
                .filter(Boolean)
                .join(" | ") || "-"}
            </Text>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.cell, styles.itemCell]}>Item</Text>

            <Text style={[styles.cell, styles.qtyCell]}>Qty</Text>

            <Text style={[styles.cell, styles.rateCell]}>
              Rate ({tableCurrencyLabel})
            </Text>

            <Text style={[styles.cell, styles.discountCell]}>
              Disc. ({tableCurrencyLabel})
            </Text>

            <Text style={[styles.cell, styles.taxableCell]}>
              Taxable ({tableCurrencyLabel})
            </Text>

            <Text style={[styles.cell, styles.gstCell]}>
              GST ({tableCurrencyLabel})
            </Text>

            <Text style={[styles.cell, styles.totalCell]}>
              Total ({tableCurrencyLabel})
            </Text>
          </View>

          <View style={styles.tableBody}>
            {document.items.map((item, index) => {
              const gstPaise =
                item.cgst_paise + item.sgst_paise + item.igst_paise;

              return (
                <View
                  key={item.id}
                  wrap={false}
                  style={[
                    index === document.items.length - 1
                      ? styles.tableRowLast
                      : styles.tableRow,
                    ...(index % 2 === 1 ? [styles.tableRowAlt] : []),
                  ]}
                >
                  <View style={[styles.cell, styles.itemCell]}>
                    <Text style={styles.itemName}>{item.item_name}</Text>

                    <Text style={styles.itemMeta}>
                      {item.hsn_sac ? `HSN/SAC: ${item.hsn_sac}` : "HSN/SAC: -"}
                      {" | "}
                      {item.unit ?? "-"}
                      {" | GST "}
                      {(item.gst_rate_bps / 100).toFixed(2)}%
                    </Text>
                  </View>

                  <Text style={[styles.cell, styles.qtyCell]}>
                    {(item.quantity_milli / 1000).toFixed(3)}
                  </Text>

                  <Text style={[styles.cell, styles.rateCell]}>
                    {formatTableMoney(item.rate_paise)}
                  </Text>

                  <Text style={[styles.cell, styles.discountCell]}>
                    {formatTableMoney(item.discount_paise)}
                  </Text>

                  <Text style={[styles.cell, styles.taxableCell]}>
                    {formatTableMoney(item.taxable_amount_paise)}
                  </Text>

                  <Text style={[styles.cell, styles.gstCell]}>
                    {formatTableMoney(gstPaise)}
                  </Text>

                  <Text style={[styles.cell, styles.totalCell]}>
                    {formatTableMoney(item.total_paise)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.summaryGrid} wrap={false}>
          <View style={styles.amountWordsBlock}>
            <Text style={styles.sectionTitle}>Amount in Words</Text>

            <Text style={styles.textBlock}>
              {formatAmountInWords(document.totals.total_paise)}
            </Text>
          </View>

          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Gross</Text>

              <Text>
                {formatMoney(
                  document.totals.subtotal_paise,
                  document.currency_code,
                )}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.muted}>Discount</Text>

              <Text>
                -{" "}
                {formatMoney(
                  document.totals.discount_paise,
                  document.currency_code,
                )}
              </Text>
            </View>

            {!isPurchaseOrder &&
              document.additional_charge.amount_paise > 0 && (
                <>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, styles.chargeLabel]}>
                      {document.additional_charge.label ||
                        "Additional Charge"}
                    </Text>

                    <Text>
                      {formatMoney(
                        document.additional_charge.amount_paise,
                        document.currency_code,
                      )}
                    </Text>
                  </View>

                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, styles.chargeLabel]}>
                      {document.additional_charge.taxable
                        ? "Taxable @ " +
                          (
                            document.additional_charge
                              .gst_rate_bps / 100
                          ).toString() +
                          "% GST"
                        : "Non-taxable charge"}
                    </Text>
                  </View>

                  {document.additional_charge.taxable && (
                    <View style={styles.totalRow}>
                      <Text style={[styles.muted, styles.chargeLabel]}>
                        GST on charge (included in tax below)
                      </Text>

                      <Text>
                        {formatMoney(
                          document.additional_charge.tax_paise,
                          document.currency_code,
                        )}
                      </Text>
                    </View>
                  )}
                </>
              )}

            <View style={[styles.totalRow, styles.totalDivider]}>
              <Text>Taxable</Text>

              <Text>
                {formatMoney(
                  document.totals.taxable_amount_paise,
                  document.currency_code,
                )}
              </Text>
            </View>

            {document.totals.igst_paise > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>IGST</Text>

                <Text>
                  {formatMoney(
                    document.totals.igst_paise,
                    document.currency_code,
                  )}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>CGST</Text>

                  <Text>
                    {formatMoney(
                      document.totals.cgst_paise,
                      document.currency_code,
                    )}
                  </Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.muted}>SGST</Text>

                  <Text>
                    {formatMoney(
                      document.totals.sgst_paise,
                      document.currency_code,
                    )}
                  </Text>
                </View>
              </>
            )}

            {document.totals.cess_paise > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Cess</Text>

                <Text>
                  {formatMoney(
                    document.totals.cess_paise,
                    document.currency_code,
                  )}
                </Text>
              </View>
            )}

            {document.totals.round_off_paise !== 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Round Off</Text>

                <Text>
                  {formatMoney(
                    document.totals.round_off_paise,
                    document.currency_code,
                  )}
                </Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.totalDivider]}>
              <Text style={styles.grandTotal}>Grand Total</Text>

              <Text style={styles.grandTotal}>
                {formatMoney(
                  document.totals.total_paise,
                  document.currency_code,
                )}
              </Text>
            </View>

            {!isPurchaseOrder && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>Amount Paid</Text>

                  <Text>
                    {formatMoney(
                      document.totals.amount_paid_paise,
                      document.currency_code,
                    )}
                  </Text>
                </View>

                <View style={[styles.totalRow, styles.totalDivider]}>
                  <Text style={styles.grandTotal}>Balance Due</Text>

                  <Text style={styles.grandTotal}>
                    {formatMoney(
                      balanceDuePaise,
                      document.currency_code,
                    )}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {(document.notes || document.terms_and_conditions) && (
          <View style={styles.notesTermsGrid}>
            <View style={styles.notesColumn}>
              {document.notes && (
                <>
                  <Text style={styles.sectionTitle}>
                    {isPurchaseOrder ? "Notes" : "Customer Notes"}
                  </Text>

                  <Text style={styles.textBlock}>{document.notes}</Text>
                </>
              )}
            </View>

            <View style={styles.termsColumn}>
              {document.terms_and_conditions && (
                <>
                  <Text style={styles.sectionTitle}>Terms & Conditions</Text>

                  <Text style={styles.textBlock}>
                    {document.terms_and_conditions}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        <View
          style={[
            styles.footerBox,
            ...(isPurchaseOrder ? [styles.footerBoxPurchaseOrder] : []),
          ]}
          wrap={false}
        >
          {!isPurchaseOrder && (
            <>
              <View
                style={[
                  styles.bankBlock,
                  ...(!showPaymentQr ? [styles.bankBlockNoQr] : []),
                ]}
              >
                <Text style={styles.sectionTitle}>Bank & Payment Details</Text>

                {!hasPaymentDetails && (
                  <Text style={[styles.smallText, styles.muted]}>
                    Payment details not configured
                  </Text>
                )}

                {paymentDetails.bank_name && (
                  <Text style={styles.smallText}>
                    Bank: {paymentDetails.bank_name}
                  </Text>
                )}

                {paymentDetails.account_holder_name && (
                  <Text style={styles.smallText}>
                    A/C Holder: {paymentDetails.account_holder_name}
                  </Text>
                )}

                {paymentDetails.account_number && (
                  <Text style={styles.smallText}>
                    A/C No: {paymentDetails.account_number}
                  </Text>
                )}

                {paymentDetails.ifsc_code && (
                  <Text style={styles.smallText}>
                    IFSC: {paymentDetails.ifsc_code}
                  </Text>
                )}

                {paymentDetails.branch_name && (
                  <Text style={styles.smallText}>
                    Branch: {paymentDetails.branch_name}
                  </Text>
                )}

                {paymentDetails.upi_id && (
                  <Text style={styles.smallText}>
                    UPI: {paymentDetails.upi_id}
                  </Text>
                )}
              </View>

              {showPaymentQr && paymentQrDataUrl && (
                <View style={styles.qrBlock}>
                  <Image src={paymentQrDataUrl} style={styles.qrImage} />

                  <Text style={styles.qrLabel}>Scan to Pay</Text>
                </View>
              )}
            </>
          )}

          <View
            style={[
              styles.signatoryBlock,
              ...(!isPurchaseOrder && !showPaymentQr
                ? [styles.signatoryBlockNoQr]
                : []),
            ]}
          >
            <Text style={styles.signatoryCompany}>
              For {company.trade_name || company.legal_name}
            </Text>

            {signatureDataUrl && (
              <Image src={signatureDataUrl} style={styles.signatureImage} />
            )}

            <Text style={styles.signatoryLabel}>Authorized Signatory</Text>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
