# Deploying Sands & Vows (AWS Amplify + Resend)

The site is plain static HTML in `design/`. A small Amplify Gen 2 backend (`amplify/`) adds one
Lambda function that emails every enquiry to the team through Resend. WhatsApp keeps working
whether or not the email backend is set up.

What gets published: `design/` minus `design-book.html` (built into `dist/` by `npm run build`,
see `amplify.yml`). The design book stays in the repo.

## Before you start (checked 30 Sep 2026)

- `sandsandvows.com` did not resolve in DNS (no NS, MX or A records). Register the domain, or check
  that it is registered and its nameservers are set, before steps 4 and 6.
- Enquiries are routed to `sandsandvows@pkphotography.in`. You can override this with
  `ENQUIRY_TO` if the inbox changes.
- Resend: only `pkphotography.in` is a verified sending domain. `sandsandvows.com` is not added yet.

## 1. Connect the repo

1. AWS console → Amplify → Create new app → GitHub → repository `pkwebapp/sandsandvows`, branch `main`.
2. App settings: leave "My app is a monorepo" unticked. Amplify reads `amplify.yml` from the repo root.
3. Service role: choose "Create and use a new service role" (Gen 2 needs it to deploy the backend).

## 2. Confirm build settings

The build settings screen should show the repo's `amplify.yml`:

- backend: `npm install` (uses package-lock.json; `npm ci` trips over Amplify's bundled deps) then `npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID`
- frontend: `npm run build`, artifacts `baseDirectory: dist`

Build image settings: Node.js 20 or newer.

## 3. Add settings (before the first deploy, or redeploy after adding)

Amplify → your app → Hosting → **Secrets** (per branch or all branches):

| Name | Value |
|---|---|
| `RESEND_API_KEY` | A Resend API key with "Sending access" (create it in Resend → API Keys) |

Amplify → your app → Hosting → **Environment variables**:

| Name | Value |
|---|---|
| `ENQUIRY_TO` | `sandsandvows@pkphotography.in` (or any inbox you read; comma-separate for several) |
| `ENQUIRY_FROM` | `Sands & Vows Enquiries <enquiries@sandsandvows.com>` once step 4 is done. Until then use the verified domain, e.g. `Sands & Vows Enquiries <enquiries@pkphotography.in>` |
| `ENQUIRY_ALLOWED_ORIGINS` | Optional. Your `https://main.xxxx.amplifyapp.com` preview URL, if you want the email copy to work there too |

Never put real values in the repo. `.env.example` lists the names only.

## 4. Verify sandsandvows.com in Resend

1. Resend → Domains → Add domain → `sandsandvows.com` (region: Tokyo `ap-northeast-1`, same as pkphotography.in).
2. Add exactly the DNS records Resend shows (DKIM and SPF/return-path records) at your DNS host.
3. Wait for "Verified", then set `ENQUIRY_FROM` to an `@sandsandvows.com` address and redeploy.

## 5. First deploy and the endpoint URL

1. Deploy (Amplify builds on every push to `main`, or click "Redeploy this version").
2. The backend creates a Lambda Function URL. The frontend build reads it from
   `amplify_outputs.json` and writes it into the published `availability.html`
   (`<meta name="sv-enquiry-url" content="...">`). The build log line
   `Enquiry endpoint: https://...lambda-url...on.aws/` confirms it.
3. If that line says "not set", redeploy once, or set the environment variable `SV_ENQUIRY_URL`
   to the Function URL (Lambda console → the function whose name contains `enquiry` →
   Configuration → Function URL) and redeploy. You can also paste it into the meta tag in
   `design/availability.html`.
4. Test: open the site, send an enquiry through Book us. WhatsApp opens as before, and a note
   "We've also emailed your enquiry to our team." appears when the email is sent. Check the inbox.
   Logs: CloudWatch → log group of the `enquiry` function (outcome codes only, no personal data).

## 6. Custom domain

1. Amplify → Hosting → Custom domains → Add domain → `sandsandvows.com`.
2. Follow the DNS steps shown (Route 53 does it automatically; other DNS hosts need the CNAME records).
3. Add both `sandsandvows.com` and `www.sandsandvows.com` and choose which one redirects to the other.
   Both are already allowed by the enquiry endpoint.

## 7. 404 page

Amplify → Hosting → Rewrites and redirects → add: source `/<*>`, target `/404.html`, type `404 (Rewrite)`.

## Notes

- Spam protection: hidden honeypot field, minimum 3 seconds on the page, 10 KB body limit,
  origin allow-list, and a best-effort limit of 5 enquiries per IP per 10 minutes per warm Lambda.
- Local tests: `npm install && npm test` (handler with a mocked Resend), `npm run typecheck`, `npm run build`.
- Costs at this volume should stay within the Lambda free tier; check Resend's current plan limits.
