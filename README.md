# HelpLift

**Giving made transparent. Impact made real.**

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

Layers 1 and 2 live in the same Next.js codebase (`HelpLift App/`), and the frontend does **not** always go through the backend logic layer to reach the database. Two paths exist side by side:

- **Frontend → Supabase, directly.** Dashboards and pages (e.g. `admin-dashboard`, `givers-dashboard`, `organisation-dashboard`) load most of their data with the browser Supabase client, querying Postgres straight from the client. This is safe only because Row Level Security policies on every table enforce who can read/write what - the database itself is the access-control layer here, not application code.
- **Frontend → Next.js API route → Supabase.** Anything needing server-side business logic, validation, secrets, payment processing, outbound email, or a privileged service-role bypass (e.g. incrementing a failed-login counter before any session exists) goes through an `app/api/**/route.ts` handler instead, using either the caller's own session (subject to RLS) or a service-role client.

Either way, Supabase enforces almost every access rule at the database level via RLS policies and triggers, not just in application code - the database is the last line of defense regardless of which path a request took.

### RESTful APIs

The backend logic layer is exposed as a REST API via Next.js Route Handlers (`app/api/**/route.ts`, 100+ endpoints) - each file is a resource, and the HTTP method on it maps to the action:

- `GET` - fetch a resource or list (e.g. `GET /api/organization/needs`)
- `POST` - create a resource (e.g. `POST /api/organization/needs`)
- `PATCH` - update part of a resource (e.g. `PATCH /api/organization/needs/[id]`)
- `DELETE` - remove a resource (e.g. `DELETE /api/admin/needs/[id]`)

Requests and responses are JSON (or `multipart/form-data` for file uploads, e.g. need attachments and verification documents), routes are organized by role/resource (`api/admin/...`, `api/organization/...`, `api/giver/...`, `api/public/...`), and every non-public route authenticates the caller and checks their role/permissions before touching the database. The frontend consumes this API with plain `fetch()` calls - there's no separate API client library.

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

## Repository layout

```
HelpLift/
├── HelpLift App/          # the Next.js application - see below
├── supabase/
│   ├── migrations/        # ~90 timestamped SQL migrations - the source of truth for schema & RLS
│   ├── email-templates/   # Supabase Auth email template overrides
│   └── role_based_access_all_in_one.sql
└── .trae/                 # legacy AI-IDE planning docs (reference only)
```

Inside `HelpLift App/`:

```
app/              # App Router: role dashboards & public pages, plus api/ (100+ Route Handlers)
components/       # shared React components (dialogs, cards, ui/ primitives)
lib/              # business logic & integrations (payments, mailer, geolocation, banking, notifications...)
hooks/            # shared React hooks
public/           # static assets, PWA manifest & icons
```

Database changes are made by adding a new timestamped file to `supabase/migrations/` (never editing an existing one) and applying it to the Supabase project.

## Core features

- **Three account types**: Giver, Organization (with `owner`/`manager`/`viewer` team roles), and Admin.
- **Needs marketplace**: organizations post needs (draft → admin-approved → open); givers browse, filter "by preference" or "near me" (real distance matching against forward-geocoded need locations), and express interest.
- **Gift Library**: givers pledge in-kind items or funds; organizations claim pledges, subject to admin review.
- **Donations**: EFT (with proof-of-payment upload), PayFast, and PayPal, either to a specific need/organization or directly to the platform - with generated receipts.
- **Organization verification**: document upload and admin review before an organization's needs can go public.
- **Admin moderation**: needs/gifts/impact-story approval, need "reopen" requests (with a required motivation), user & organization management, platform settings, analytics, and admin-only deletion of historical records (fulfilled needs, decided claims, completed fulfillments).
- **Messaging & notifications**: in-app messaging plus email notifications, with a choice of notification sounds.
- **Security**: Row Level Security on every table, account lockout after repeated failed logins (unlocked via an emailed verification code), WebAuthn passkeys, and database triggers preventing self-privilege-escalation.
- **Accessibility**: grammar checking, speech-to-text/text-to-speech, adjustable font size, and four themes including high-contrast and grayscale.
- **PWA**: installable, with offline awareness.

## Getting started

Prerequisites: Node.js, a [Supabase](https://supabase.com) project, and (optional, for full functionality) a Brevo account and PayFast/PayPal sandbox credentials.

```bash
cd "HelpLift App"
npm install
```

1. Copy the environment variables below into `HelpLift App/.env.local`.
2. Apply every file in `supabase/migrations/` to your Supabase project, in filename order (via the SQL editor, or the Supabase CLI).
3. Configure Google/LinkedIn/Microsoft as OAuth providers in the Supabase Auth dashboard if you want social sign-in.
4. Run the dev server:

```bash
npm run dev
```

## Environment variables

Set these in `HelpLift App/.env.local` (never commit this file):

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
| `PAYPAL_SANDBOX_CLIENT_ID` / `PAYPAL_SANDBOX_SECRET_KEY` / `PAYPAL_WEBHOOK_ID` | PayPal payment gateway |

## Scripts

Run from inside `HelpLift App/`:

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint the codebase |
