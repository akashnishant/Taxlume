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
  page: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    fontSize: 7.5,
    fontFamily: "Helvetica",
    color: "#111827",
    lineHeight: 1.25,
  },

  watermark: {
    position: "absolute",
    top: "42%",
    left: "18%",
    fontSize: 64,
    fontWeight: 700,
    color: "#e5e7eb",
    transform: "rotate(-35deg)",
    opacity: 0.6,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  companyBlock: {
    width: "58%",
  },

  documentHeadingBlock: {
    width: "40%",
    alignItems: "flex-end",
  },

  companyName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
  },

  companyLegalName: {
    fontSize: 8,
    marginBottom: 2,
  },

  smallText: {
    fontSize: 7,
    lineHeight: 1.25,
  },

  muted: {
    color: "#6b7280",
  },

  documentTitle: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: "right",
    lineHeight: 1.2,
  },

  documentNumber: {
    marginTop: 5,
    fontSize: 8,
    fontWeight: 700,
    textAlign: "right",
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    marginBottom: 7,
  },

  // taxlume-stage2a6: sales PDF enhancements
  shipToBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 7,
    marginBottom: 8,
  },

  chargeLabel: {
    width: "60%",
    paddingRight: 5,
  },

  infoGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 8,
  },

  infoColumn: {
    width: "50%",
    padding: 7,
  },

  infoColumnRight: {
    width: "50%",
    padding: 7,
    borderLeftWidth: 1,
    borderLeftColor: "#d1d5db",
  },

  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 4,
    textTransform: "uppercase",
  },

  partyName: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 2,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
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
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 8,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    fontWeight: 700,
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  tableRowLast: {
    flexDirection: "row",
  },

  cell: {
    paddingVertical: 4,
    paddingHorizontal: 3,
  },

  itemCell: {
    width: "24%",
  },

  qtyCell: {
    width: "8%",
    textAlign: "right",
  },

  rateCell: {
    width: "14%",
    textAlign: "right",
  },

  discountCell: {
    width: "13%",
    textAlign: "right",
  },

  taxableCell: {
    width: "14%",
    textAlign: "right",
  },

  gstCell: {
    width: "13%",
    textAlign: "right",
  },

  totalCell: {
    width: "14%",
    textAlign: "right",
  },

  itemName: {
    fontWeight: 700,
  },

  itemMeta: {
    marginTop: 1,
    fontSize: 6.2,
    color: "#6b7280",
  },

  summaryGrid: {
    flexDirection: "row",
    marginBottom: 8,
  },

  amountWordsBlock: {
    width: "52%",
    paddingRight: 10,
  },

  totalsBlock: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 6,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },

  totalDivider: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 4,
    marginTop: 2,
  },

  grandTotal: {
    fontSize: 9,
    fontWeight: 700,
  },

  notesTermsGrid: {
    flexDirection: "row",
    marginBottom: 8,
  },

  notesColumn: {
    width: "50%",
    paddingRight: 8,
  },

  termsColumn: {
    width: "50%",
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
  },

  textBlock: {
    fontSize: 6.8,
    lineHeight: 1.3,
    color: "#374151",
  },

  footerBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d1d5db",
    minHeight: 78,
    marginTop: "auto",
  },

  bankBlock: {
    width: "48%",
    padding: 7,
  },

  qrBlock: {
    width: "20%",
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#d1d5db",
  },

  signatoryBlock: {
    width: "32%",
    padding: 7,
    borderLeftWidth: 1,
    borderLeftColor: "#d1d5db",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  footerBoxPurchaseOrder: {
    borderWidth: 0,
    justifyContent: "flex-end",
  },

  signatoryBlockPurchaseOrder: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },

  qrImage: {
    width: 58,
    height: 58,
    objectFit: "contain",
  },

  qrLabel: {
    marginTop: 2,
    fontSize: 6,
    color: "#6b7280",
    textAlign: "center",
  },

  signatureImage: {
    width: 85,
    height: 34,
    objectFit: "contain",
    marginVertical: 3,
  },

  signatoryCompany: {
    fontSize: 7,
    fontWeight: 700,
    textAlign: "right",
  },

  signatoryLabel: {
    fontSize: 7,
    fontWeight: 700,
    textAlign: "right",
  },

  pageNumber: {
    position: "absolute",
    bottom: 8,
    left: 24,
    right: 24,
    textAlign: "center",
    fontSize: 6.5,
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

            <Text style={styles.smallText}>
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

        {!isPurchaseOrder && (
          <View style={styles.shipToBox}>
            <Text style={styles.sectionTitle}>
              Ship To
              {shipToSameAsBillTo
                ? " - Same as Bill To"
                : ""}
            </Text>

            {shipToSameAsBillTo ? (
              <>
                <Text style={styles.partyName}>
                  {document.party?.display_name ||
                    document.party?.legal_name ||
                    "-"}
                </Text>

                {document.party?.legal_name &&
                  document.party.legal_name !==
                    document.party.display_name && (
                    <Text style={styles.smallText}>
                      {document.party.legal_name}
                    </Text>
                  )}

                <Text style={styles.smallText}>
                  {[
                    partyAddress?.address_line1,
                    partyAddress?.address_line2,
                  ]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </Text>

                <Text style={styles.smallText}>
                  {[
                    partyAddress?.city,
                    partyAddress?.state,
                    partyAddress?.pincode,
                    partyAddress?.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </Text>

                <Text style={styles.smallText}>
                  GSTIN: {document.party?.gstin || "-"}
                </Text>

                <Text style={styles.smallText}>
                  {[
                    document.party?.phone,
                    document.party?.email,
                  ]
                    .filter(Boolean)
                    .join(" | ") || "-"}
                </Text>
              </>
            ) : (
              <>
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
                  {[
                    document.ship_to.phone,
                    document.ship_to.email,
                  ]
                    .filter(Boolean)
                    .join(" | ") || "-"}
                </Text>
              </>
            )}
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.cell, styles.itemCell]}>Item</Text>

            <Text style={[styles.cell, styles.qtyCell]}>Qty</Text>

            <Text style={[styles.cell, styles.rateCell]}>Rate</Text>

            <Text style={[styles.cell, styles.discountCell]}>Disc.</Text>

            <Text style={[styles.cell, styles.taxableCell]}>Taxable</Text>

            <Text style={[styles.cell, styles.gstCell]}>GST</Text>

            <Text style={[styles.cell, styles.totalCell]}>Total</Text>
          </View>

          {document.items.map((item, index) => {
            const gstPaise =
              item.cgst_paise + item.sgst_paise + item.igst_paise;

            return (
              <View
                key={item.id}
                wrap={false}
                style={
                  index === document.items.length - 1
                    ? styles.tableRowLast
                    : styles.tableRow
                }
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
                  {formatMoney(item.rate_paise, document.currency_code)}
                </Text>

                <Text style={[styles.cell, styles.discountCell]}>
                  {formatMoney(item.discount_paise, document.currency_code)}
                </Text>

                <Text style={[styles.cell, styles.taxableCell]}>
                  {formatMoney(
                    item.taxable_amount_paise,
                    document.currency_code,
                  )}
                </Text>

                <Text style={[styles.cell, styles.gstCell]}>
                  {formatMoney(gstPaise, document.currency_code)}
                </Text>

                <Text style={[styles.cell, styles.totalCell]}>
                  {formatMoney(item.total_paise, document.currency_code)}
                </Text>
              </View>
            );
          })}
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
              <View style={styles.bankBlock}>
                <Text style={styles.sectionTitle}>Bank & Payment Details</Text>

                <Text style={styles.smallText}>
                  Bank: {paymentDetails.bank_name ?? "-"}
                </Text>

                <Text style={styles.smallText}>
                  A/C Holder: {paymentDetails.account_holder_name ?? "-"}
                </Text>

                <Text style={styles.smallText}>
                  A/C No: {paymentDetails.account_number ?? "-"}
                </Text>

                <Text style={styles.smallText}>
                  IFSC: {paymentDetails.ifsc_code ?? "-"}
                </Text>

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

          <View style={styles.signatoryBlock}>
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
