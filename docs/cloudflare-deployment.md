# Cloudflare deployment: Techabanca Billing

Techabanca Billing is deployed on Cloudflare using the existing infrastructure created before the Techabanca rebrand. Internal Cloudflare resource names are intentionally retained to protect existing data, bindings, subscriptions, and deployment history.

## Production topology

| Role | Production endpoint / resource |
| --- | --- |
| Company website | `https://techabanca.com` |
| Billing frontend | `https://billing.techabanca.com` |
| Billing API | `https://billing-api.techabanca.com` |
| Cloudflare Pages project | `taxlume` |
| Cloudflare Worker | `billdesk` |
| D1 database | `billdesk-db` |
| R2 bucket | `billdesk-files` |

The original Cloudflare resource names are internal implementation details. The public product is Techabanca Billing.

## Frontend API configuration

The production frontend must be built with:

`VITE_API_BASE_URL=https://billing-api.techabanca.com`

The GitHub Actions Pages workflow uses the repository variable `VITE_API_BASE_URL` when present and otherwise falls back to the production Techabanca Billing API domain.

Do not include a trailing slash in `VITE_API_BASE_URL`.

## CORS

The `billdesk` Worker must explicitly allow the production frontend origin:

`https://billing.techabanca.com`

Cloudflare Pages preview origins may remain in the allowlist when preview deployments are required.

The API custom domain `billing-api.techabanca.com` is attached to the existing `billdesk` Worker. The legacy `workers.dev` hostname may remain available for diagnostics or rollback but is not the production API endpoint used by the frontend.

## Deployment

Pushing applicable changes to `main` triggers the existing GitHub Actions workflows:

- the frontend workflow builds the React/Vite application and deploys `frontend/dist` to the existing `taxlume` Pages project;
- the Worker workflow deploys the existing `billdesk` Worker.

GitHub Actions does not automatically apply remote D1 migrations.

Database migrations must be reviewed and applied deliberately. Domain or CORS changes by themselves do not require a D1 migration.

## Verification

After a deployment, verify:

1. `https://techabanca.com` loads the Techabanca company website.
2. `https://billing.techabanca.com` loads Techabanca Billing.
3. Login and registration call `https://billing-api.techabanca.com`.
4. The Worker allows CORS from `https://billing.techabanca.com`.
5. `/api/health` succeeds on the production API domain.
6. Authenticated application APIs work after sign-in.
7. Subscription, document, PDF, customer, vendor, and product workflows continue to use the existing production data.
8. Razorpay plan, price, subscription, and provider identifiers remain unchanged unless a separate payment migration is intentionally performed.

## Existing resources

Do not rename or recreate the following merely for branding:

- Pages project `taxlume`
- Worker `billdesk`
- D1 database `billdesk-db`
- R2 bucket `billdesk-files`
- existing Razorpay plan, subscription, and provider identifiers

The Techabanca rebrand is intentionally separated from the underlying infrastructure identifiers.

## Rollback

If a frontend or Worker deployment causes an issue, redeploy a previously verified revision or use Cloudflare deployment rollback facilities.

Do not attempt rollback by recreating D1, R2, subscription IDs, or payment-provider resources.