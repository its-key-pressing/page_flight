# PageFlight

**Domain:** app.pageflight.io (frontend) · pageflight.io (marketing, Webflow — out of scope)
**Pitch:** The only landing page tester that simulates adblock cosmetic filters against EasyList. Catch invisible ad-spend killers before you run campaigns.

---

## Current Phase

**Phase 1 — MVP** · Week 1
Session 1 complete: project scaffolded, DB schema defined, queue wired, design system set.
Session 2 complete: full scan flow working end-to-end — URL form → queue → worker → results scorecard.
Session 3 complete: auth (email + Google OAuth), middleware, login/signup pages, dashboard, anonymous scan limit.
Session 4 complete: full UI polish — sidebar nav, dashboard scan cards + stats + empty state, results severity labels + share + re-scan, scan progress page redesign.

**Session 5 — in progress**
- Payments switched from LemonSqueezy → Dodo Payments (`dodopayments` npm package)
- Supabase MCP added to `.claude/settings.json` (HTTP transport, `https://mcp.supabase.com`) — requires restart + auth token to activate
- No repo yet — GitHub push is Session 5 first task before Vercel/Railway deploy
- DB migrations pending (run in Supabase SQL editor before starting worker changes):
  - Migration A: `ALTER TABLE public.scan_jobs ADD COLUMN IF NOT EXISTS ip_address TEXT;`
  - Migration B: Drop + recreate `scan_results_check_type_check` constraint to include `'first_impression'`
  - Migration C: Rename `public.users.lemon_customer_id` → `dodo_customer_id` (or add `dodo_customer_id` and backfill, then drop legacy column) + update app types

---

## Pricing Model

| Tier | Price | Limits | Key features |
|------|-------|--------|--------------|
| **Free** | $0 | 5 scans/month · 1 at a time · 7-day history | Watermarked PDF · All 4 checks · No account needed for first 3 |
| **Pro** | $49/mo | Unlimited scans · Bulk (10 URLs) · Permanent history | Clean PDF · Shareable report links · Priority queue · Re-scan |
| **Agency** | $149/mo | Bulk (50 URLs) · Everything in Pro | Client workspaces · White-label PDF · Team seats · CSV export |

**Conversion logic:**
- Anonymous: 3 scans free (localStorage gate) → signup prompt
- Free account: 5 scans/month → upgrade prompt
- Pro → Agency: bulk limit + white-label are the key upgrade triggers

---

## Feature List

### ✅ Built
- Next.js 14 App Router project scaffold (TypeScript strict, Tailwind)
- Design system: Sora + Inter fonts, Indigo-600 primary, design tokens in tailwind.config.ts + globals.css
- `lib/types.ts` — shared TypeScript types (ScanJob, ScanResult, CheckType, UserProfile)
- `lib/supabase/client.ts` + `server.ts` — browser and server Supabase clients
- `lib/queue/index.ts` — BullMQ queue with Upstash Redis (rediss://, port 6379) + `enqueueScan()`
- `lib/ssrf-blocklist.ts` — SSRF protection (blocks private IPs, localhost, cloud metadata)
- `middleware.ts` — Supabase session refresh on every request
- `app/api/scan/route.ts` — POST: validate URL → create scan_job → enqueue (attaches user_id if logged in)
- `app/api/scan/[id]/status/route.ts` — GET: return job status + per-check progress
- `app/auth/callback/route.ts` — OAuth code exchange → redirect to dashboard
- `app/auth/signout/route.ts` — POST sign-out → redirect to home
- `app/page.tsx` — home page: hero + 4 check cards + bottom CTA · localStorage scan counter (3 free → /signup gate)
- `app/scan/[id]/page.tsx` — polished progress page: per-check rows highlight while running, SVG spinner/check/X, "X of 4 complete" counter
- `app/results/[id]/page.tsx` — results scorecard: colored left border (green/red), severity labels (Critical/High/Medium), "why it matters for ads" callout, share button (copy URL), re-scan button for logged-in users, public footer CTA
- `app/results/[id]/ResultActions.tsx` — client components: ShareButton (clipboard) + RescanButton (POST /api/scan)
- `app/login/page.tsx` — email + password + Google OAuth
- `app/signup/page.tsx` — email registration + Google OAuth + scan limit banner
- `app/dashboard/page.tsx` — scan cards: favicon, domain, date, per-check icons, score badge · stats bar · empty state
- `app/dashboard/layout.tsx` — sidebar layout wrapper (ml-60 content area)
- `components/Navbar.tsx` — public: Log in + Sign up · logged-in: logo + Free plan badge only
- `components/Sidebar.tsx` — server component: user avatar/email/plan + sign out
- `components/SidebarNav.tsx` — client component: active state with usePathname(), New Scan + Dashboard + Upgrade + Settings
- `workers/index.ts` + `workers/processor.ts` — BullMQ worker, runs 4 checks sequentially
- `workers/checks/seo.ts` — H1 count, meta title length (10–60), meta description (50–160)
- `workers/checks/adblock.ts` — EasyList CSS injection + DOM diff + before/after screenshots
- `workers/checks/mobile.ts` — 375px viewport: horizontal overflow + tap target size
- `workers/checks/form.ts` — fill + submit + success confirmation check
- `supabase/migrations/001_initial.sql` — Full DB schema + RLS + auto-user trigger
- `.env.local` — configured with Supabase + Upstash credentials

### 📋 To Do

**Session 5 — Deploy + Payments** ← NEXT
- [ ] Run DB migrations (ip_address column + first_impression check_type constraint)
- [ ] New 5th check: `workers/checks/first-impression.ts` (desktop/mobile screenshots, CTA above fold, overlay >40%)
- [ ] Cookie banner auto-dismissal in `workers/processor.ts` before existing checks run
- [ ] Server-side rate limiting in `app/api/scan/route.ts` (anon: 3/24h by IP · free: 5/month · pro: unlimited)
- [ ] Push to new GitHub repo → deploy frontend to Vercel, worker to Railway
- [ ] `/upgrade` pricing page (Free / Pro $49 / Agency $149, annual toggle, feature comparison table)
- [ ] `app/api/checkout/route.ts` — Dodo Payments checkout session creator
- [ ] `app/api/webhooks/dodo/route.ts` — webhook handler → update `users.plan`
- [ ] `lib/gates.ts` — feature gate helpers (canBulkScan, canExportCleanPDF, canMonitor, canWhiteLabel)

**Session 6 — Monitoring**
- Weekly re-scan cron job (Vercel cron)
- Regression detection: compare latest vs previous scan, flag score drops
- Email alerts via Resend when a monitored page regresses
- `/settings` page: manage monitored URLs, notification preferences

**Session 7 — Growth**
- Canny or Featurebase feedback widget (floating button, not custom-built)
- Scan count on home page ("X pages audited this week") — pull from Supabase count
- Home page example reports section (blurred screenshots, labelled "Example report")
- PDF export: watermarked for Free, clean for Pro (use `@react-pdf/renderer`)

**Session 8-9 — Chrome Extension**
- Manifest v3 extension
- Popup: scan current tab URL with one click, shows pass/fail summary, links to full web report
- Passive mode (v2): badge warns when visiting a page with adblock-class CSS patterns
- Shares same backend — no new infrastructure needed

---

## Scanner Checks (detail)

| Check | Severity | What it tests |
|-------|----------|--------------|
| **Adblock** | Critical | EasyList cosmetic filter simulation — injects CSS hiding ad-pattern selectors, diffs which elements disappear. Core moat. |
| **Form** | Critical | Fills fields by heuristic, clicks submit, checks for success confirmation. |
| **Mobile** | High | Horizontal overflow at 375px · tap targets < 44×44px on interactive elements |
| **SEO** | Medium | H1 missing/duplicate/empty · meta title 10–60 chars · meta description 50–160 chars |

All 4 checks run sequentially so the progress page can show which check is currently running.

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Next.js 14 App Router + TypeScript strict + Tailwind CSS (custom, no DaisyUI theme) |
| Scanner workers | Node.js + Playwright — Railway persistent containers |
| Job queue | BullMQ + Upstash Redis (serverless, no ops) |
| Database | Supabase (Postgres + JSONB) |
| Auth | Supabase Auth (email + Google OAuth) |
| Payments | Dodo Payments — `dodopayments` npm SDK for checkout sessions; webhooks drive plan changes in Supabase |
| Email | Resend (transactional alerts) |
| Feedback | Canny or Featurebase (not custom-built) |
| Analytics | PostHog (product analytics + session recording + feature flags) |
| Deploy (FE) | Vercel — app.pageflight.io via CNAME in Namecheap DNS |
| Deploy (workers) | Railway — persistent containers |

---

## Database Schema (current)

```sql
scan_jobs    id (uuid PK), url, status (queued|running|completed|failed),
             user_id (FK → auth.users, nullable), created_at, completed_at

scan_results id (uuid PK), job_id (FK → scan_jobs), check_type (adblock|mobile|form|seo),
             passed (bool), issues (JSONB), screenshots (JSONB), created_at

users        id (uuid PK → auth.users), email, plan (free|pro|agency),
             dodo_customer_id, created_at
```

RLS: users see only their own rows. Anonymous scan_jobs (user_id = null) are readable by anyone.

**Schema note:** `supabase/migrations/001_initial.sql` still defines `lemon_customer_id` until a Session 5 migration renames or replaces it with `dodo_customer_id` (and `lib/types.ts` is updated to match).

---

## Key Decisions

| Decision | Why |
|----------|-----|
| BullMQ + Upstash Redis | Playwright takes 5-30s — Vercel 10s timeout kills synchronous scans. Queue is non-negotiable. |
| Upstash Redis TCP port 6379 | Upstash TLS Redis uses port 6379 (not 6380). `rediss://` URL with IORedis avoids Windows EPERM socket bug. |
| Workers on Railway | Persistent containers required for Playwright. Simpler than Fly.io for solo dev. |
| Supabase (not PlanetScale) | Auth included. JSONB for evolving scan results schema. Dashboard for debugging. |
| Dodo Payments (replaces LemonSqueezy) | Checkout + subscription flows via official SDK; webhook handler keeps `users.plan` in sync. Chosen for Session 5 integration path; tax/VAT posture depends on Dodo’s current MoR / seller-of-record options — verify in their docs before launch. |
| Sequential checks (not parallel) | Progress UX — frontend shows which check is running in real time. |
| SSRF protection in API | Scanner runs Playwright which could hit internal network. Block private IPs before creating any job. |
| Worker uses `-r tsx/cjs` | `--import tsx/esm` causes module resolution failures on Windows. |
| Sidebar only on /dashboard | Public pages (home, results, scan progress) keep the top navbar — sidebar only for the logged-in app shell via `app/dashboard/layout.tsx`. No file restructuring needed. |
| No DaisyUI theme | DaisyUI themes are visually identifiable and generic. Custom Tailwind preserves brand identity. |
| Anonymous gate = localStorage | Soft gate, not hard paywall. Converts users who see value. Server-side enforcement in Session 5. |
| Feedback widget = Canny/Featurebase | Building custom costs a week with zero moat. Canny handles submissions, voting, roadmap automatically. |
| Chrome extension deferred to Session 8-9 | Get web app to solid v1 first. Extension shares same backend — mostly a UI job. |

---

## Known Issues / Blockers

- Not yet deployed — running locally only. Deploy to Vercel + Railway is Session 5 priority #1.
- Scan count not enforced server-side (localStorage only) — hard enforcement in Session 5.
- Worker must be started manually with `npm run worker` (Railway deployment pending).
- `/upgrade` and `/settings` pages are stubs — built in Session 5 and 6.
