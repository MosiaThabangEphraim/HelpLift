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

The backend logic layer is exposed as a REST API via Next.js Route Handlers (`app/api/**/route.ts`, 120+ endpoints) - each file is a resource, and the HTTP method on it maps to the action:

- `GET` - fetch a resource or list (e.g. `GET /api/organization/needs`)
- `POST` - create a resource (e.g. `POST /api/organization/needs`)
- `PATCH` - update part of a resource (e.g. `PATCH /api/organization/needs/[id]`)
- `DELETE` - remove a resource (e.g. `DELETE /api/admin/needs/[id]`)

Requests and responses are JSON (or `multipart/form-data` for forms with files, e.g. need attachments and verification documents), routes are organized by role/resource (`api/admin/...`, `api/organization/...`, `api/giver/...`, `api/public/...`), and every non-public route authenticates the caller and checks their role/permissions before touching the database. The frontend consumes this API with plain `fetch()` calls - there's no separate API client library.

### File uploads

Vercel rejects any request larger than 4.5 MB, so files never travel inside a form to the API. The browser uploads each file straight to a private `upload-staging` storage bucket using a one-time signed upload link (`app/api/uploads/sign`, `lib/stage-uploads.ts`). The API route that receives the form then reads the file back with the service role, checks its real type and size against that upload's limits (`lib/upload-limits.ts`), moves it to its usual bucket and deletes the staged copy (`lib/staged-uploads.ts`). Before uploading, images are compressed in the browser and every file's type is checked from its contents, not its extension (`lib/media-optimizer.ts`).

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
├── HelpLift App/          # the Next.js application - see below
└── supabase/
    ├── migrations/        # ~95 timestamped SQL migrations - the source of truth for schema & RLS
    ├── email-templates/   # Supabase Auth email template overrides
    └── role_based_access_all_in_one.sql
```

Inside `HelpLift App/`:

```
app/              # App Router: role dashboards & public pages, plus api/ (120+ Route Handlers)
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
- **Admin moderation**: needs/gifts/impact-story approval, need "reopen" requests (with a required motivation), user & organization management (editing names, contact and giver details, roles, suspension and password resets - but never banking details), platform settings, and analytics.
- **Admin record deletion**: admins can delete most records, with a preview of what else will be removed. Financial records - donations, withdrawals, and needs or accounts that hold them - can never be deleted; accounts with financial history are suspended instead.
- **Announcements**: messages to users by in-app notification and email, which can also go up as a login page banner or a public homepage notice, each switched on or off from the announcement dialog.
- **Messaging & notifications**: in-app messaging plus email notifications, with a choice of notification sounds.
- **Lifty, the AI assistant**: a chat assistant available across the site that knows how HelpLift works and can look up live data (open needs, organizations, the signed-in user's own activity - no other users' personal data). Supports voice input and spoken replies, and can be turned off in Settings.
- **AI need writer**: organizations describe a need in a sentence and get a complete need form filled in, which they review before posting.
- **Snap to pledge**: givers take or upload a photo of an item and the AI fills in the gift pledge for them.
- **Homepage needs map & live feed**: an interactive map of open needs (each pin opens the needs board) and a live feed of recent platform activity.
- **First-time dashboard tour**: a short step-by-step tour for givers, organizations and admins on their first visit, saved per account.
- **Live activity (admin)**: who's online now and what signed-in users are doing - pages opened, settings changed, actions taken - filterable by kind, role, person and date/time, with an option to clear the log. Kept for 90 days.
- **Login attempts (admin)**: an audit of successful and failed sign-ins with time, device and IP address.
- **Developers page**: a public page about how HelpLift is built, with an anonymous form for reporting bugs and ideas (with screenshots). Admins get notified and can reply by email.
- **Security**: Row Level Security on every table, two-factor authentication by emailed code, account lockout after repeated failed logins (unlocked via an emailed verification code), WebAuthn passkeys, rate limiting on sensitive routes, 18+ age confirmation for givers at registration, and database triggers preventing self-privilege-escalation.
- **Accessibility**: grammar checking, speech-to-text/text-to-speech (including read aloud on announcements), adjustable font size, a Reduce motion setting, optional click sounds, and four themes including high-contrast and grayscale.
- **Dashboards**: refresh buttons that reload data without losing filters, smooth tab transitions, and an optional analog and digital clock with the date.
- **PWA**: installable, with offline awareness.

## Getting started

Prerequisites: Node.js, a [Supabase](https://supabase.com) project, and (optional, for full functionality) a Brevo account and PayFast/PayPal sandbox credentials.

```bash
cd "HelpLift App"
npm install
```

1. Copy the environment variables below into `HelpLift App/.env.local`.
2. Apply every file in `supabase/migrations/` to your Supabase project, in filename order (via the SQL editor, or the Supabase CLI).
   This also creates the storage buckets, including the private `upload-staging` bucket used for all file uploads.
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
| `PAYPAL_SANDBOX_CLIENT_ID` / `PAYPAL_SANDBOX_SECRET_KEY` / `PAYPAL_SANDBOX_URL` / `PAYPAL_WEBHOOK_ID` | PayPal payment gateway |
| `GEMINI_API_KEY` | Google Gemini API key for the AI features (Lifty, need writer, Snap to pledge) |
| `NEXT_PUBLIC_ENABLE_SW` | Optional - set to `true` to turn on the service worker in development (it's always on in production) |

## Scripts

Run from inside `HelpLift App/`:

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint the codebase |

## Deployment

The app is built for [Vercel](https://vercel.com):

1. Import the repository and set **Root Directory** to `HelpLift App`.
2. Add the environment variables above, with `NEXT_PUBLIC_SITE_URL` set to the deployed address.
3. In Supabase, set **Authentication → URL Configuration** (Site URL and redirect URLs) to the deployed address, and point the notification-email database webhook at `/api/webhooks/notification-created`.
4. Point the PayPal webhook at `/api/public/paypal/webhook` and use its ID for `PAYPAL_WEBHOOK_ID`.

Every push to `main` redeploys the site. Database migrations are not applied automatically - apply new ones in Supabase before pushing code that depends on them.
