# Techabanca Billing preview rollout (historical)

This document records the preview rollout used before the production Techabanca domains were activated. The current company website is `https://techabanca.com`. This stage puts the rebranded Billing frontend at `techabanca-rebrand.taxlume.pages.dev` for review. `taxlume.pages.dev` stays on its existing production frontend. A domain purchase is not needed yet.

## Source and resources

- The prepared rebrand starts from commit `9040790a9ba4cb326f82d4b108c8094fa3d75ac6` on `techabanca-rebrand-base`.
- The Pages project remains `taxlume`, the Worker remains `billdesk`, D1 remains `billdesk-db`, and R2 remains `billdesk-files`. No plan, price, provider, document, or subscription ID is changed.
- The frontend calls `https://billing-api.techabanca.com` at build time. Substitute your actual Worker origin if it differs.
- The API response may still carry the old plan display name until the final release. The preview frontend maps the *exact* legacy name `Taxlume Standard` to `Techabanca Billing Standard` for display and checkout; it preserves custom names and IDs.

## 1. Add the preview origin to the live Worker

The Cloudflare API requires an explicit CORS origin for the new Pages branch. Deploy the supplied **CORS-only API package** first. It is based on the currently published repository `main` commit `8c343f8` and adds only `https://techabanca-rebrand.taxlume.pages.dev` to the allowlist. Review your current production Worker source first if you have deployed any newer, unpushed backend changes. The package retains the existing `billdesk` Worker name and D1/R2 bindings; it does not alter secrets or apply a database migration.

Download `Techabanca-Preview-API.zip` into Downloads and run PowerShell:

```powershell
$apiOut = Join-Path $HOME 'Downloads\techabanca-preview-api'
Expand-Archive "$HOME\Downloads\Techabanca-Preview-API.zip" -DestinationPath $apiOut -Force
Set-Location (Join-Path $apiOut 'Techabanca-Preview-API')
npm ci
npx tsc --noEmit
npx wrangler whoami
npx wrangler deploy
```

After deployment, verify `/api/health` on the Worker URL. Do not change the Razorpay webhook URL or existing Worker secrets.

## 2. Build and deploy the branded frontend to a Pages preview branch

On your clean local repository at commit `9040790`, download and apply `Techabanca-Billing-Preview.patch`:

```powershell
Set-Location 'C:\Users\Akash\free-billing-software\billdesk'
git rev-parse HEAD
git status --short
git switch -c feat/techabanca-billing-preview
git am "$HOME\Downloads\Techabanca-Billing-Preview.patch"
Set-Location .\frontend
npm ci
$env:VITE_API_BASE_URL = 'https://billing-api.techabanca.com'
npm run build
Set-Location ..
npx wrangler pages deploy .\frontend\dist --project-name taxlume --branch techabanca-rebrand
```

Check that `git rev-parse HEAD` showed `9040790a9ba4cb326f82d4b108c8094fa3d75ac6` and `git status --short` was empty **before** applying the patch. The Pages command creates a branch preview, leaving `taxlume.pages.dev` as the production URL. Cloudflare prints the actual deployment URL; the branch alias should be `https://techabanca-rebrand.taxlume.pages.dev`.

If you prefer not to patch your checkout, extract `Techabanca-Billing-Preview-Source.zip`, install/build its `frontend` with the same `VITE_API_BASE_URL`, and deploy its `frontend/dist` with the Pages command above. The ready-built `Techabanca-Billing-Preview-Pages.zip` can also be extracted and deployed as a directory if the Worker URL above is correct.

## 3. Review before production cutover

Open the preview's `/welcome`, `/login`, `/register`, `/subscribe`, and an authenticated workspace page. Check branding, navigation, existing account sign-in, plan display, document workflows, PDF downloads, and sign-out. The preview shares the live API and data, so use a non-sensitive test account and do not complete a real payment during visual review. Because browser storage is per origin, the preview may ask you to sign in again.

Do **not** merge the rebrand into `main`, run migration `0014`, or deploy the full rebranded Worker until the preview is accepted. Existing GitHub Actions workflows deploy on `main`.

## Final release after review

From the rebranded source, deploy the full `billdesk` Worker, review pending D1 migrations, apply only the intended `0014_techabanca_billing_brand.sql` remotely, then deploy `frontend/dist` to the production `main` branch of the `taxlume` Pages project. The migration changes only the displayed plan name. Verify auth, an appropriate Razorpay checkout, documents, and subscriptions on the production URL. Keep the old Pages hostname while there is no custom domain. After buying `techabanca.com`, attach `billing.techabanca.com` and update the company site's Billing link.

Cloudflare references: [Pages preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).


