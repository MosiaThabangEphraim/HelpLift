# HelpLift

**Giving made transparent. Impact made real.**

**Live site: [helplift.vercel.app](https://helplift.vercel.app)**

HelpLift connects verified organizations posting community needs with individual and business givers ready to help - through monetary donations, in-kind/financial gift pledges, and direct messaging - with an administrator layer moderating everything in between.

## Architecture

The app is a single Next.js project split across three logical layers - but layer 1 can reach layer 3 either through layer 2 or directly, not strictly in a straight line:

```
1. FRONTEND             Next.js (React) pages, dashboards, forms, dialogs
                         what the user sees and interacts with
                             
          
2. BACKEND LOGIC              
   Next.js Route Handlers      
   (app/api/**/route.ts)
   business rules: "can this
   user donate?", "create
   this need", "process this
   payment", "send this
   notification"


3. SUPABASE (BaaS)       PostgreSQL · Auth · Storage · Row Level Security
                         the actual backend infrastructure
```

Layers 1 and 2 live in the same Next.js codebase (`helplift-app/`), and the frontend does **not** always go through the backend logic layer to reach the database. Two paths exist side by side:

- **Frontend → Supabase, directly.** Dashboards and pages (e.g. `admin-dashboard`, `givers-dashboard`, `organisation-dashboard`) load most of their data with the browser Supabase client, querying Postgres straight from the client. This is safe only because Row Level Security policies on every table enforce who can read/write what - the database itself is the access-control layer here, not application code.
- **Frontend → Next.js API route → Supabase.** Anything needing server-side business logic, validation, secrets, payment processing, outbound email, or a privileged service-role bypass (e.g. incrementing a failed-login counter before any session exists) goes through an `app/api/**/route.ts` handler instead, using either the caller's own session (subject to RLS) or a service-role client.

Either way, Supabase enforces almost every access rule at the database level via RLS policies and triggers, not just in application code - the database is the last line of defense regardless of which path a request took.

### RESTful APIs

The backend logic layer is exposed as a REST API via Next.js Route Handlers (`app/api/**/route.ts`, 120+ endpoints) - each file is a resource, and the HTTP method on it maps to the action:

- `GET` - fetch a resource or list (e.g. `GET /api/organization/needs`)
- `POST` - create a resource (e.g. `POST /api/organization/needs`)
- `PATCH` - update part of a resource (e.g. `PATCH /api/organization/needs/[id]`)
- `DELETE` - remove a resource (e.g. `DELETE /api/admin/needs/[id]`)

Requests and responses are JSON (or `multipart/form-data` for forms with files, e.g. need attachments and verification documents), routes are organized by role/resource (`api/admin/...`, `api/organization/...`, `api/giver/...`, `api/public/...`), and every non-public route authenticates the caller and checks their role/permissions before touching the database. The frontend consumes this API with plain `fetch()` calls - there's no separate API client library.

### File uploads

Vercel rejects any request larger than 4.5 MB, so files never travel inside a form to the API. The browser uploads each file straight to a private `upload-staging` storage bucket using a one-time signed upload link (`app/api/uploads/sign`, `lib/stage-uploads.ts`). The API route that receives the form then reads the file back with the service role, checks its real type and size against that upload's limits (`lib/upload-limits.ts`), moves it to its usual bucket and deletes the staged copy (`lib/staged-uploads.ts`). Before uploading, images are compressed in the browser and every file's type is checked from its contents, not its extension (`lib/media-optimizer.ts`).

Private files (documents, proofs, attachments, evidence) are never linked with a pre-signed URL, since those expire while a page stays open. Pages link to `/api/files/<bucket>/<path>` (`lib/file-links.ts`), which signs a fresh two-minute URL at the moment of the click using the visitor's own session - so the bucket's storage policies still decide who may open each file.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript |
| Styling / UI | Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com) on Radix UI primitives, Framer Motion, `next-themes` (light/dark/high-contrast/grayscale) |
| Forms & validation | `react-hook-form`, `zod` |
| Charts & exports | `recharts`, `@react-pdf/renderer` (receipts, compliance certificates), CSV export, chart-to-image export |
| Database / BaaS | [Supabase](https://supabase.com) - PostgreSQL, Auth, Storage, Row Level Security |
| Authentication | Supabase Auth (email/password, email OTP), WebAuthn passkeys, Google/LinkedIn/Microsoft OAuth (configured as Supabase Auth providers) |
| Payments | PayFast, PayPal, manual EFT with proof-of-payment upload |
| Transactional email | Brevo HTTP API (`lib/mailer.ts`) - independent of Supabase Auth's own email system |
| PWA / offline | `next-pwa`, a custom service worker, an offline-aware provider |
| Accessibility | `harper.js` (grammar checking), Web Speech API (speech-to-text / text-to-speech), adjustable font size |
| Geolocation | Browser Geolocation API + OpenStreetMap Nominatim (free forward/reverse geocoding, no API key) for "needs near me" |
| QR codes | `qrcode`, `html-to-image` |
| AI | Google Gemini API (`lib/gemini.ts`) - Lifty assistant, AI need writer, Snap to pledge photo analysis |
| Maps | Leaflet with OpenStreetMap tiles (homepage needs map) |
| Media | `browser-image-compression`, file signature checks before upload |
| Animation | `tw-animate-css` (tab transitions; off with Reduce motion) |

## Repository layout

```
HelpLift/
├── helplift-app/          # the Next.js application - see below
└── supabase/
    ├── migrations/        # ~95 timestamped SQL migrations - the source of truth for schema & RLS
    ├── email-templates/   # Supabase Auth email template overrides
    └── role_based_access_all_in_one.sql
```

Inside `helplift-app/`:

```
app/              # App Router: role dashboards & public pages, plus api/ (120+ Route Handlers)
components/       # shared React components (dialogs, cards, ui/ primitives)
lib/              # business logic & integrations (payments, mailer, geolocation, banking, notifications...)
hooks/            # shared React hooks
public/           # static assets, PWA manifest & icons
```

Database changes are made by adding a new timestamped file to `supabase/migrations/` (never editing an existing one) and applying it to the Supabase project.

## Core features

- **Three account types**: Giver, Organization (with `owner`/`manager`/`coordinator` team roles), and Admin. Owners have full access, including banking, withdrawals, documents and the team; managers run needs, offers, Gift Library claims and stories and can see donations and the wallet; coordinators handle deliveries (fulfillments and proof), messages and impact stories, with no access to needs, offers, claims or money (`lib/organization-access.ts`, `20261008000500_coordinator_role.sql`).
- **Needs marketplace**: organizations post needs (draft → admin-approved → open); givers browse, filter "by preference" or "near me" (real distance matching against forward-geocoded need locations), and express interest.
- **Gift Library**: givers pledge in-kind items or funds; organizations claim pledges, subject to admin review.
- **Donations**: EFT (with proof-of-payment upload), PayFast, and PayPal, either to a specific need/organization or directly to the platform - with generated receipts.
- **Organization verification**: document upload and admin review before an organization's needs can go public.
- **Admin moderation**: needs/gifts/impact-story approval, need "reopen" requests (with a required motivation), closing a live need (with an optional reason; the organization and its givers are notified), revoking an approved organization's verification or reconsidering a rejected one, permanently deleting an organization (refused if it has any donations or withdrawals; its team accounts and files go with it), removing a listed Gift Library offering (paid financial pledges excepted), cancelling a stuck delivery or marking one completed, user & organization management (editing names, contact and giver details, roles, suspension and password resets - but never banking details), platform settings, and analytics.
- **Admin record deletion**: admins can delete most records, with a preview of what else will be removed. Financial records - donations, withdrawals, and needs or accounts that hold them - can never be deleted; accounts with financial history are suspended instead.
- **Announcements**: messages to users by in-app notification and email, which can also go up as a login page banner or a public homepage notice, each switched on or off from the announcement dialog.
- **Messaging & notifications**: in-app messaging plus email notifications, with a choice of notification sounds. Need status changes reach everyone involved (`lib/need-notifications.ts`): organizations hear about admin decisions and removals, admins hear when an organization closes, fulfils or asks to reopen a need (in the bell, opening the Needs tab), and givers with an open offer or a donation hear when a need is fulfilled, closed (including by the nightly due-date job) or removed.
- **Lifty, the AI assistant**: a chat assistant available across the site that knows how HelpLift works and can look up live data (open needs, organizations, the signed-in user's own activity - no other users' personal data). Supports voice input and spoken replies, and can be turned off in Settings. **"Hey Lifty"** (opt-in in Settings, Chrome/Edge): saying the wake phrase opens Lifty, which greets the user aloud and starts a hands-free voice chat; it listens only while the tab is visible and the chat is closed (`lib/wake-word.ts`).
- **AI need writer**: organizations describe a need in a sentence and get a complete need form filled in, which they review before posting.
- **Snap to pledge**: givers take or upload a photo of an item and the AI fills in the gift pledge for them.
- **Homepage needs map & live feed**: an interactive map of open needs (each pin opens the needs board) and a live feed of recent platform activity.
- **First-time dashboard tour**: a short step-by-step tour for givers, organizations and admins on their first visit, saved per account.
- **Live activity (admin)**: who's online now and what signed-in users are doing - pages opened, settings changed, actions taken - filterable by kind, role, person and date/time, with an option to clear the log. Kept for 90 days.
- **Login attempts (admin)**: an audit of successful and failed sign-ins with time, device and IP address, filterable by result, period or an exact From/To date range, exportable to CSV, and clearable (the clearing itself is recorded in Live activity, as is clearing the Live activity log).
- **Developers page**: a public page about how HelpLift is built, with an anonymous form for reporting bugs and ideas (with screenshots). Admins get notified and can reply by email.
- **Security**: Row Level Security on every table, two-factor authentication by emailed code, account lockout after repeated failed logins (unlocked via an emailed verification code), WebAuthn passkeys, rate limiting on sensitive routes, 18+ age confirmation for givers at registration, and database triggers preventing self-privilege-escalation.
- **Accessibility**: grammar checking, speech-to-text/text-to-speech (including read aloud on announcements), adjustable font size, a Reduce motion setting, optional click sounds, and four themes including high-contrast and grayscale.
- **Dashboards**: refresh buttons that reload data without losing filters, smooth tab transitions, and an optional analog and digital clock with the date. On phones, all three dashboards switch to an app-style layout (`components/mobile-section-nav.tsx`): a bottom bar with the most-used sections and a "More" sheet for the rest plus quick actions, a section heading, "waiting" chips instead of stat cards, and a borderless icon toolbar for the header buttons (`.mobile-toolbar` in `globals.css`). Filter chip rows (needs categories, gift types, need and tip-off statuses) become one dropdown on phones (`components/mobile-filter-select.tsx`). Desktop is unchanged. On desktop, every dashboard has a "search anything" box at the top left (`components/dashboard-search.tsx`): it finds the dashboard's sections, actions and settings - including things nested inside other screens, such as each Platform settings field (withdrawal limits, badge thresholds, bank accounts...), the Users groups and the Wallet's banking details - and jumps straight to them, accepts speech-to-text, and opens with Ctrl+K or "/".
- **Due dates and expiry**: a need is listed up to and including its due date and a Gift Library offering up to its expiry date (South African time). Public lists, Lifty and the homepage counts hide anything past its date straight away (`lib/expiry.ts`), and it can no longer receive offers, donations or claims. `public.expire_overdue_items()` closes open needs past their due date and expires overdue offerings, notifying the organization or giver; it runs daily at 00:05 SAST with pg_cron and is also triggered by the public APIs (`lib/expiry-job.ts`). Needs in progress and offerings with a claim in progress are left alone, reopening an overdue need requires a new due date, and money never expires (donations and financial pledges are skipped).
- **Anonymous tip-offs**: a homepage form for reporting a registered organization for fraud, abuse or other illegal or suspicious activity, with optional evidence files. Nothing identifying the sender is stored. Admins are notified in-app and investigate from the **Inquiries** tab, which also holds contact-form inquiries.
- **Organization timelines**: each organization posts updates, events (date, time, location), milestones and news with images and documents to its own public timeline - no admin approval. It shows on the public profile, as the latest post on directory cards, and to Lifty. Coordinators and up post and edit their own posts; managers and owners edit, delete or pin any; admins can remove posts (`components/org-timeline.tsx`, `app/api/organization/timeline`, `20261009000100_organization_timeline.sql`).
- **User manual**: a PDF guide for all users, downloadable from Settings (`public/helplift-user-manual.pdf`, generated by `scripts/generate-user-manual.tsx`). The first-time tour ends by pointing to it and to Lifty.
- **PWA**: installable, with offline awareness.

## Getting started

Prerequisites: Node.js, a [Supabase](https://supabase.com) project, and (optional, for full functionality) a Brevo account and PayFast/PayPal sandbox credentials.

```bash
cd "helplift-app"
npm install
```

1. Copy the environment variables below into `helplift-app/.env.local`.
2. Apply every file in `supabase/migrations/` to your Supabase project, in filename order (via the SQL editor, or the Supabase CLI).
   This also creates the storage buckets, including the private `upload-staging` bucket used for all file uploads.
3. Configure Google/LinkedIn/Microsoft as OAuth providers in the Supabase Auth dashboard if you want social sign-in.
4. Run the dev server:

```bash
npm run dev
```

## Environment variables

Set these in `helplift-app/.env.local` (never commit this file):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key - server-only, bypasses RLS |
| `NEXT_PUBLIC_SITE_URL` | The site's own public URL, used in emails/links |
| `BREVO_API_KEY` / `SMTP_FROM` | Brevo transactional email (contact form, notifications, account-lockout codes) |
| `CONTACT_EMAIL_TO` | Inbox the "Partner with us" contact form sends to |
| `NOTIFICATION_WEBHOOK_SECRET` | Shared secret guarding the Supabase → Next.js notification-email webhook |
| `PAYFAST_MERCHANT_ID` / `PAYFAST_MERCHANT_KEY` / `PAYFAST_PASSPHRASE` / `PAYFAST_URL` | PayFast payment gateway |
| `PAYPAL_SANDBOX_CLIENT_ID` / `PAYPAL_SANDBOX_SECRET_KEY` / `PAYPAL_SANDBOX_URL` / `PAYPAL_WEBHOOK_ID` | PayPal payment gateway |
| `GEMINI_API_KEY` | Google Gemini API key for the AI features (Lifty, need writer, Snap to pledge) |
| `NEXT_PUBLIC_ENABLE_SW` | Optional - set to `true` to turn on the service worker in development (it's always on in production) |

## Scripts

Run from inside `helplift-app/`:

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint the codebase |
| `npx tsx scripts/generate-user-manual.tsx` | Rebuild the user manual PDF (`public/helplift-user-manual.pdf`) after editing its text |

## Deployment

The live site is **[helplift.vercel.app](https://helplift.vercel.app)**, hosted on [Vercel](https://vercel.com).

| Setting | Value |
|---|---|
| Hosting | Vercel project `helplift` |
| Framework preset | Next.js |
| Root directory | `helplift-app` |
| Build / install | Vercel defaults (`npm install`, `next build`) |
| Function region | `dub1` (Dublin), close to the Supabase database |
| Database, auth and storage | Supabase, region `eu-west-1` (Ireland) |
| Email | Brevo |
| Payments | PayFast (ZAR) and PayPal (international, charged in USD) |

### Deploying for the first time

1. In Vercel, import the GitHub repository and set **Root Directory** to `helplift-app`.
2. Under **Settings → Functions**, set the region to `dub1` so the server runs near the database.
3. Add every environment variable listed above under **Settings → Environment Variables** (Production), with `NEXT_PUBLIC_SITE_URL` set to `https://helplift.vercel.app`. Mark the server keys (service role, Brevo, PayFast, PayPal, Gemini, webhook secret) as sensitive.
4. Deploy, then configure the outside services to point at the live address:
   - **Supabase → Authentication → URL Configuration:** Site URL `https://helplift.vercel.app`, and redirect URL `https://helplift.vercel.app/**`.
   - **Google, LinkedIn and Microsoft OAuth apps:** keep the Supabase callback URL (`https://<project>.supabase.co/auth/v1/callback`) as the authorized redirect.
   - **Supabase database webhook** for new notifications: `https://helplift.vercel.app/api/webhooks/notification-created`, sending the `NOTIFICATION_WEBHOOK_SECRET`.
   - **PayFast:** notifications go to `/api/public/payfast/notify` automatically. Switch `PAYFAST_URL` and the merchant keys to live values when leaving the sandbox.
   - **PayPal:** point the webhook at `https://helplift.vercel.app/api/public/paypal/webhook` and use its ID for `PAYPAL_WEBHOOK_ID`.

### Updating the live site

- Every push to `main` redeploys the site automatically. Other branches get their own preview deployments.
- Database migrations are **not** applied automatically. Apply new files in `supabase/migrations/` in Supabase before pushing code that depends on them.
- Changing an environment variable in Vercel only takes effect after a redeploy (**Deployments → ⋯ → Redeploy**).
- The user manual PDF in `public/` is served as it is, so regenerate it before pushing if its text changed.
