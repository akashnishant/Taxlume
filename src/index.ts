import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HealthCheck } from "./endpoints/health";
import { Register } from "./endpoints/register";
import { Login } from "./endpoints/login";
import { Me } from "./endpoints/me";
import { CustomerCreate } from "./endpoints/customerCreate";
import { CustomerList } from "./endpoints/customerList";
import { CustomerGet } from "./endpoints/customerGet";
import { CustomerUpdate } from "./endpoints/customerUpdate";
import { CustomerStatus } from "./endpoints/customerStatus";
import { VendorCreate } from "./endpoints/vendorCreate";
import { VendorList } from "./endpoints/vendorList";
import { VendorGet } from "./endpoints/vendorGet";
import { VendorUpdate } from "./endpoints/vendorUpdate";
import { VendorStatus } from "./endpoints/vendorStatus";
import { ProductCreate } from "./endpoints/productCreate";
import { ProductList } from "./endpoints/productList";
import { ProductGet } from "./endpoints/productGet";
import { ProductUpdate } from "./endpoints/productUpdate";
import { ProductStatus } from "./endpoints/productStatus";
import { DocumentCreate } from "./endpoints/documentCreate";
import { DocumentList } from "./endpoints/documentList";
import { DocumentGet } from "./endpoints/documentGet";
import { DocumentStatus } from "./endpoints/documentStatus";
import { DocumentUpdate } from "./endpoints/documentUpdate";
import { CompanyGet } from "./endpoints/companyGet";
import { CompanyUpdate } from "./endpoints/companyUpdate";
import { PaymentDetailsGet } from "./endpoints/paymentDetailsGet";
import { PaymentDetailsUpdate } from "./endpoints/paymentDetailsUpdate";
import { PaymentQrUpload } from "./endpoints/paymentQrUpload";
import { PaymentQrGet } from "./endpoints/paymentQrGet";
import { PaymentQrDelete } from "./endpoints/paymentQrDelete";
import { CompanySignatureUpload } from "./endpoints/companySignatureUpload";
import { CompanySignatureGet } from "./endpoints/companySignatureGet";
import { CompanySignatureDelete } from "./endpoints/companySignatureDelete";
import { DocumentSnapshotAssetGet } from "./endpoints/documentSnapshotAssetGet";
import { SubscriptionPlanList } from "./endpoints/subscriptionPlanList";
import { SubscriptionCurrent } from "./endpoints/subscriptionCurrent";
import { SubscriptionCheckout } from "./endpoints/subscriptionCheckout";
import { razorpayWebhookHandler } from "./endpoints/razorpayWebhook";
import { SubscriptionReconcile } from "./endpoints/subscriptionReconcile";
import { DashboardSummary } from "./endpoints/dashboardSummary";
import { ReportSalesRegister } from "./endpoints/reportSalesRegister";
import { ReportPurchaseOrderRegister } from "./endpoints/reportPurchaseOrderRegister";
import { ReportTaxSummary } from "./endpoints/reportTaxSummary";
import { InvoiceReceiptList } from "./endpoints/invoiceReceiptList";
import { InvoiceReceiptCreate } from "./endpoints/invoiceReceiptCreate";
import { InvoiceReceiptReverse } from "./endpoints/invoiceReceiptReverse";
import { ReportOverview } from "./endpoints/reportOverview";
import { ExpenseCategoryList } from "./endpoints/expenseCategoryList";
import { ExpenseCategoryCreate } from "./endpoints/expenseCategoryCreate";
import { ExpenseCategoryGet } from "./endpoints/expenseCategoryGet";
import { ExpenseCategoryUpdate } from "./endpoints/expenseCategoryUpdate";
import { ExpenseCategoryStatus } from "./endpoints/expenseCategoryStatus";
import { ExpenseCreate } from "./endpoints/expenseCreate";
import { ExpenseGet } from "./endpoints/expenseGet";
import { ExpenseList } from "./endpoints/expenseList";
import { ExpenseUpdate } from "./endpoints/expenseUpdate";
import { ExpenseDelete } from "./endpoints/expenseDelete";
import { ExpenseAttachmentUpload } from "./endpoints/expenseAttachmentUpload";
import { ExpenseAttachmentList } from "./endpoints/expenseAttachmentList";
import { ExpenseAttachmentGet } from "./endpoints/expenseAttachmentGet";
import { ExpenseAttachmentDelete } from "./endpoints/expenseAttachmentDelete";
import { RecurringExpenseCreate } from "./endpoints/recurringExpenseCreate";
import { RecurringExpenseGet } from "./endpoints/recurringExpenseGet";
import { RecurringExpenseList } from "./endpoints/recurringExpenseList";
import { RecurringExpenseStatus } from "./endpoints/recurringExpenseStatus";
import { RecurringExpenseUpdate } from "./endpoints/recurringExpenseUpdate";
import { generateDueRecurringExpenses } from "./utils/expenses/generateRecurringExpenses";
import { RecurringExpenseDelete } from "./endpoints/recurringExpenseDelete";

import { authMiddleware } from "./middleware/auth";
import { subscriptionMiddleware } from "./middleware/subscription";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

const allowedOrigins = [
  "http://localhost:5173",
  "https://billing.techabanca.com",
  "https://taxlume.pages.dev",
  "https://techabanca-rebrand.taxlume.pages.dev",
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Keep Cloudflare Pages deployment previews working
      if (
        origin.endsWith(".taxlume.pages.dev") &&
        origin.startsWith("https://")
      ) {
        return origin;
      }

      return "";
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],

    exposeHeaders: [
      "Content-Disposition",
      "X-Content-Type-Options",
    ],
  }),
);

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/health", HealthCheck);
openapi.post("/api/auth/register", Register);
openapi.post("/api/auth/login", Login);
openapi.get(
    "/api/subscription-plans",
    SubscriptionPlanList,
);

app.post(
    "/api/webhooks/razorpay",
    razorpayWebhookHandler,
);

app.use("/api/auth/me", authMiddleware);

openapi.get(
	"/api/auth/me",
	Me,
);

app.use(
    "/api/subscriptions/current",
    authMiddleware,
);

openapi.get(
    "/api/subscriptions/current",
    SubscriptionCurrent,
);

app.use(
    "/api/subscriptions/checkout",
    authMiddleware,
);

openapi.post(
    "/api/subscriptions/checkout",
    SubscriptionCheckout,
);

app.use(
    "/api/subscriptions/reconcile",
    authMiddleware,
);

openapi.post(
    "/api/subscriptions/reconcile",
    SubscriptionReconcile,
);

app.use(
    "/api/dashboard/*",
    authMiddleware,
);

app.use(
    "/api/dashboard/*",
    subscriptionMiddleware,
);

openapi.get(
    "/api/dashboard/summary",
    DashboardSummary,
);

app.use(
  "/api/reports/*",
  authMiddleware,
  subscriptionMiddleware,
);

openapi.get(
  "/api/reports/overview",
  ReportOverview,
);

openapi.get(
  "/api/reports/sales",
  ReportSalesRegister,
);

openapi.get(
  "/api/reports/purchase-orders",
  ReportPurchaseOrderRegister,
);

openapi.get(
  "/api/reports/tax-summary",
  ReportTaxSummary,
);

// Expense Categories
app.use(
    "/api/expense-categories",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/expense-categories/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.get(
    "/api/expense-categories",
    ExpenseCategoryList,
);

openapi.post(
    "/api/expense-categories",
    ExpenseCategoryCreate,
);

openapi.get(
    "/api/expense-categories/:id",
    ExpenseCategoryGet,
);

openapi.put(
    "/api/expense-categories/:id",
    ExpenseCategoryUpdate,
);

openapi.patch(
    "/api/expense-categories/:id/status",
    ExpenseCategoryStatus,
);

app.use(
    "/api/expenses",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/expenses/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.post(
    "/api/expenses",
    ExpenseCreate,
);

openapi.post(
    "/api/expenses",
    ExpenseCreate,
);

openapi.get(
    "/api/expenses",
    ExpenseList,
);

openapi.get(
    "/api/expenses/:id",
    ExpenseGet,
);

openapi.put(
    "/api/expenses/:id",
    ExpenseUpdate,
);

openapi.delete(
    "/api/expenses/:id",
    ExpenseDelete,
);

openapi.post(
    "/api/expenses/:id/attachments",
    ExpenseAttachmentUpload,
);

openapi.get(
    "/api/expenses/:id/attachments",
    ExpenseAttachmentList,
);

openapi.get(
    "/api/expenses/:id/attachments/:attachmentId",
    ExpenseAttachmentGet,
);

openapi.delete(
    "/api/expenses/:id/attachments/:attachmentId",
    ExpenseAttachmentDelete,
);

app.use(
    "/api/recurring-expenses",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/recurring-expenses/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.post(
    "/api/recurring-expenses",
    RecurringExpenseCreate,
);

openapi.get(
    "/api/recurring-expenses",
    RecurringExpenseList,
);

openapi.get(
    "/api/recurring-expenses/:id",
    RecurringExpenseGet,
);

openapi.patch(
    "/api/recurring-expenses/:id/status",
    RecurringExpenseStatus,
);

openapi.put(
    "/api/recurring-expenses/:id",
    RecurringExpenseUpdate,
);

openapi.delete(
    "/api/recurring-expenses/:id",
    RecurringExpenseDelete,
);

app.use(
    "/api/customers",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/customers/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.post(
	"/api/customers",
	CustomerCreate,
);

openapi.get(
    "/api/customers",
    CustomerList,
);

openapi.get(
	"/api/customers/:id",
	CustomerGet,
);

openapi.put(
	"/api/customers/:id",
	CustomerUpdate,
);

openapi.patch(
	"/api/customers/:id/status",
	CustomerStatus,
);

app.use(
    "/api/vendors",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/vendors/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.post(
	"/api/vendors",
	VendorCreate,
);

openapi.get(
	"/api/vendors",
	VendorList,
);

openapi.get(
	"/api/vendors/:id",
	VendorGet,
);

openapi.put(
	"/api/vendors/:id",
	VendorUpdate,
);

openapi.patch(
	"/api/vendors/:id/status",
	VendorStatus,
);

app.use(
    "/api/products",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/products/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.post(
	"/api/products",
	ProductCreate,
);

openapi.get(
	"/api/products",
	ProductList,
);

openapi.get("/api/products/:id", ProductGet);

openapi.put("/api/products/:id", ProductUpdate);

openapi.patch("/api/products/:id/status", ProductStatus);

app.use(
    "/api/documents",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/documents/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.post("/api/documents", DocumentCreate);

openapi.get("/api/documents", DocumentList);

openapi.get("/api/documents/:id", DocumentGet);

openapi.get(
  "/api/documents/:id/receipts",
  InvoiceReceiptList,
);

openapi.post(
  "/api/documents/:id/receipts",
  InvoiceReceiptCreate,
);

openapi.patch(
  "/api/documents/:id/receipts/:receiptId/reverse",
  InvoiceReceiptReverse,
);

openapi.put("/api/documents/:id", DocumentUpdate);

openapi.patch("/api/documents/:id/status", DocumentStatus);

openapi.get(
  "/api/documents/:id/snapshot-assets/:asset",
  DocumentSnapshotAssetGet,
);

app.use(
    "/api/company",
    authMiddleware,
    subscriptionMiddleware,
);

app.use(
    "/api/company/*",
    authMiddleware,
    subscriptionMiddleware,
);

openapi.get("/api/company", CompanyGet);

openapi.put("/api/company", CompanyUpdate);

openapi.post(
  "/api/company/signature",
  CompanySignatureUpload,
);

openapi.get(
  "/api/company/signature",
  CompanySignatureGet,
);

openapi.delete(
  "/api/company/signature",
  CompanySignatureDelete,
);

openapi.get(
  "/api/company/payment-details",
  PaymentDetailsGet,
);

openapi.put(
  "/api/company/payment-details",
  PaymentDetailsUpdate,
);

openapi.post(
  "/api/company/payment-details/qr",
  PaymentQrUpload,
);

openapi.get(
  "/api/company/payment-details/qr",
  PaymentQrGet,
);

openapi.delete(
  "/api/company/payment-details/qr",
  PaymentQrDelete,
);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default {
    fetch:
        app.fetch,

    async scheduled(
        controller:
            ScheduledController,

        env:
            Env,

        _ctx:
            ExecutionContext,
    ) {
        const result =
            await generateDueRecurringExpenses(
                env.DB,
                new Date(
                    controller.scheduledTime,
                ),
            );

        console.log(
            "Recurring expense generation completed",
            result,
        );
    },
} satisfies ExportedHandler<Env>;
