# PageFlight Security Report
Generated: 2026-03-22

---

## CRITICAL

### C1 — Open Redirect in /auth/callback
**File:** `app/auth/callback/route.ts:13,19`
**Status:** FIXED

The `next` query parameter was used directly in the redirect without validation.
An attacker could craft `/auth/callback?code=xxx&next=//evil.com` to redirect
users to an external phishing site after authentication.

**Fix:** Validate that `next` is a relative path starting with `/` and not `//`.

---

## HIGH

### H1 — IPv6 SSRF Gaps in ssrf-blocklist.ts
**File:** `lib/ssrf-blocklist.ts`
**Status:** FIXED

Missing coverage for:
- IPv6 private ranges: `fc00::/7`, `fe80::/10` (link-local)
- IPv4-mapped IPv6: `::ffff:127.0.0.1`, `::ffff:169.254.169.254`
- Brackets in IPv6 URLs: `http://[::1]`

**Fix:** Added IPv6 private ranges, bracket stripping, and IPv4-mapped detection.

---

### H2 — IP Header Spoofing Bypasses Rate Limit
**File:** `app/api/scan/route.ts:48-51`
**Status:** FIXED (documented)

`X-Forwarded-For` is a user-controlled header. On Vercel, `request.ip` reflects
the real client IP set by the edge network and cannot be spoofed. Updated to
prefer `request.ip` (Vercel) with `x-forwarded-for` as fallback for other hosts.

---

### H3 — variantId Not Validated Before Dodo API Call
**File:** `app/api/checkout/route.ts:31-34`
**Status:** FIXED

Any string was accepted as `variantId` and forwarded to the Dodo API.
An attacker could submit malformed IDs or very long strings.

**Fix:** Whitelist known variant ID placeholders and validate format with regex.

---

### H4 — PII Logged in Webhook Handler
**File:** `app/api/webhooks/dodo/route.ts:113,140`
**Status:** FIXED

User IDs and plan names were logged at INFO level. In production log aggregators
these are searchable and visible to anyone with log access.

**Fix:** Removed user IDs from success log messages.

---

### H5 — URL Length Not Bounded
**File:** `app/api/scan/route.ts` / `lib/ssrf-blocklist.ts`
**Status:** FIXED

No maximum length check on submitted URLs could allow memory/DoS issues.

**Fix:** 2048-char limit added in validateScanUrl().

---

### H6 — Status Endpoint Exposes Scan URL (Intentional — Documented)
**File:** `app/api/scan/[id]/status/route.ts`
**Status:** ACCEPTED RISK

The status endpoint returns `job.url` without auth. This is intentional:
anonymous scans (user_id=null) need to be publicly pollable for the progress page.
Scan IDs are UUIDs (128-bit) making enumeration impractical (~5×10^38 possibilities).
Supabase RLS ensures logged-in users only see their own scan rows.

**Mitigation:** RLS on `scan_jobs` — anonymous rows readable by all, logged-in rows
scoped to `auth.uid()`. Status endpoint returns minimal data (status + check types only).

---

## MEDIUM

### M1 — DODO_WEBHOOK_SECRET Not Set (Empty in .env.local)
**File:** `.env.local`, `app/api/webhooks/dodo/route.ts`
**Status:** ACTION REQUIRED — set `DODO_WEBHOOK_SECRET` in .env.local and production env vars.
Without it the webhook returns 500 and all payment events are dropped.

### M2 — No Request-Level Rate Limiting Middleware
**File:** `app/api/scan/route.ts`
**Status:** DEFERRED to Session 6 — add Upstash Ratelimit middleware for burst protection.
Current DB-query rate limiting handles sustained abuse; burst protection needs Redis.

### M3 — No CORS Restrictions on API Routes
**Status:** ACCEPTABLE for now — Next.js API routes are same-origin by default for browsers.
Webhook endpoint only called server-to-server. Document and restrict when deploying.

### M4 — Worker Browser Instances Not Capped
**File:** `workers/processor.ts`
**Status:** DEFERRED — add max concurrent job limit in BullMQ worker config (Session 6).

### M5 — Test Form Email Uses pageflight.io Domain
**File:** `workers/checks/form.ts`
**Status:** LOW RISK — change to `test@example.com` (reserved domain, RFC 2606).

---

## Non-Issues (Flagged by Audit, Dismissed)

| Item | Reason dismissed |
|------|-----------------|
| Hardcoded secrets in .env.local | .env.local is gitignored by Next.js default |
| Anon client in server.ts | Correct — anon key + RLS for user-scoped ops |
| Console.log in scan/checkout routes | Logging errors only, no PII |
| Service role key in workers | Correct — workers need privileged writes |
