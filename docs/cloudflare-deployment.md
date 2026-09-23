# Cloudflare rollout: Techabanca Billing

## Existing resources

| Role | Resource | Action |
| --- | --- | --- |
| Frontend | Existing Cloudflare Pages project `taxlume` | Attach `billing.techabanca.in` to this project. The CI workflow continues to deploy to the same project. |
| API | Existing Worker `billdesk` | Keep the current Worker URL initially. Deploy the new CORS allowlist before directing traffic to the new domain. |
| Data | D1 `billdesk-db` and R2 `billdesk-files` | Keep the same bindings, data, and storage. Apply migration 0014 to update the displayed plan name. |
| Payments | Existing Razorpay subscriptions and plan identifiers | Keep their identifiers and webhook URL; only the application and checkout presentation changes. |

The domain `techabanca.in` must be active in the Cloudflare account that owns the Pages project. Ensure the deployed app has a valid `VITE_API_BASE_URL`: GitHub Actions uses the current Worker URL by default. When a separate API custom domain is ready, set repository variable `VITE_API_BASE_URL` to that origin and redeploy the frontend.

## Rollout

1. Review the pending D1 migration in `migrations/0014_techabanca_billing_brand.sql`. Take a production D1 backup or bookmark. Verify the existing schema and earlier migrations are applied.
2. Apply the migration with authenticated Wrangler access: `npx wrangler d1 migrations apply billdesk-db --remote`. Confirm the active plan shows `Techabanca Billing Standard` in `/api/subscription-plans`. This leaves IDs, amounts, provider references, and existing subscriptions unchanged.
3. Deploy the updated Worker and frontend using the existing GitHub Actions workflows, or the equivalent authenticated Wrangler commands. Confirm the Worker is accepting CORS requests from `https://billing.techabanca.in`. Do not include a trailing slash in `VITE_API_BASE_URL`.
4. In Cloudflare **Workers & Pages → taxlume → Custom domains**, add `billing.techabanca.in` and follow the ownership/DNS prompts. Wait until Cloudflare shows the custom domain as active and its TLS certificate is ready. Preserve the existing `taxlume.pages.dev` hostname during the transition.
5. Visit the new domain over HTTPS and check `/welcome`, `/login`, `/register`, `/subscribe` and a protected app route. Exercise login, plan loading, a real or test checkout in the appropriate Razorpay environment, document downloads, and sign-out. A move to a new origin requires users to sign in again; browser storage does not travel across domains.
6. After the app is verified at the new hostname, link the corporate site's `/billing` page to `https://billing.techabanca.in`. If desired, redirect the old `*.pages.dev` hostname through a Cloudflare Bulk Redirect after checking all routes. Keep the legacy CORS origin while it is still in use.

## API custom domain (optional later)

The frontend can continue calling the existing Worker URL; both are hosted on Cloudflare. To add `api.billing.techabanca.in`, attach it as a **Worker Custom Domain** to the existing `billdesk` Worker, verify `/api/health` and the Razorpay webhook path, set repository variable `VITE_API_BASE_URL=https://api.billing.techabanca.in`, then rebuild and check login/checkout. Update the Razorpay dashboard webhook URL only when the new Worker hostname is serving and signature verification is confirmed. Keep the old Worker hostname during the transition.

## Rollback

Repoint or detach the Pages custom domain if necessary and redeploy the previous frontend/Worker revision. The migration changes only a display name; legacy plan IDs and payment references still work. Do not roll back by recreating D1, R2, or subscription IDs.

Cloudflare references: [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).
