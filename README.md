# Techabanca Billing

Techabanca Billing is a billing and business records application. The React/Vite frontend lives in `frontend/`; a Hono/Chanfana Cloudflare Worker in `src/` provides the API. Production data is stored in Cloudflare D1 and uploaded files in R2. Razorpay handles subscriptions.

## Local development

Use Node.js 22 or later. In one terminal, start the API:

```sh
npm ci
npx wrangler d1 migrations apply billdesk-db --local
npm run dev
```

Configure local Worker secrets in an ignored `.dev.vars` file for the flows you need to exercise. Do not commit credentials. In another terminal, start the frontend:

```sh
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

The default local API URL in `.env.example` is `http://127.0.0.1:8787`. The frontend serves at `http://localhost:5173`. From the repository root, check the builds:

```sh
npx tsc --noEmit
cd frontend && npm run build && npm run lint
```

The existing repository has frontend lint findings predating this rebrand; the frontend build and API type check are the deployment gates.

## Cloudflare deployment

The existing Pages project, Worker, D1 database, R2 bucket, and subscription/price IDs retain their original resource names. This protects existing data and payment links while the product is presented as Techabanca Billing. `migrations/0014_techabanca_billing_brand.sql` updates the displayed subscription plan name only.

See [Pages preview rollout](docs/preview-rollout.md) for reviewing the rebrand before buying a domain, then [Cloudflare deployment](docs/cloudflare-deployment.md) for the eventual production and `billing.techabanca.in` cutover. The GitHub Actions workflows deploy the frontend and Worker when the source is pushed to `main`; they do **not** apply remote database migrations or attach DNS automatically.

The invoices and other business documents identify the customer's own company. Product branding is kept in the application interface, reports, and subscription checkout.
