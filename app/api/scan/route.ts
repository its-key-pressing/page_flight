import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueScan } from '@/lib/queue'
import { validateScanUrl } from '@/lib/ssrf-blocklist'

/**
 * POST /api/scan
 *
 * Rate limits:
 *   - Anonymous: max 3 scans per IP per 24 hours
 *   - Free plan:  max 5 scans per calendar month
 *   - Pro/Agency: unlimited
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof (body as Record<string, unknown>).url !== 'string'
  ) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const rawUrl = ((body as Record<string, string>).url).trim()
  const safeUrl = validateScanUrl(rawUrl)

  if (!safeUrl) {
    return NextResponse.json(
      { error: 'Invalid or disallowed URL. Please enter a public HTTPS URL.' },
      { status: 422 }
    )
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Rate limiting ──────────────────────────────────────────────────────────

  if (!user) {
    // Anonymous: max 3 scans per IP per 24 hours
    // Prefer request.ip (set by Vercel edge, not spoofable) over x-forwarded-for
    const ip =
      (request as unknown as { ip?: string }).ip ??
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown'

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('scan_jobs')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null)
      .eq('ip_address', ip)
      .gte('created_at', since)

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Sign up free to keep scanning — no credit card needed.', limitReached: true },
        { status: 429 }
      )
    }
  } else {
    // Logged-in: check plan
    const { data: profile } = await supabase
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single()

    const plan = profile?.plan ?? 'free'

    if (plan === 'free') {
      // Max 5 scans per calendar month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const { count } = await supabase
        .from('scan_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart)

      if ((count ?? 0) >= 5) {
        return NextResponse.json(
          {
            error: "You've used your 5 free scans this month. Upgrade for unlimited scanning.",
            limitReached: true,
            upgradeUrl: '/upgrade',
          },
          { status: 429 }
        )
      }
    }
    // pro / agency: no limit — fall through
  }

  // ── Create scan job ────────────────────────────────────────────────────────

  const ip =
    (request as unknown as { ip?: string }).ip ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    null

  const { data: job, error: dbError } = await supabase
    .from('scan_jobs')
    .insert({
      url: safeUrl,
      status: 'queued',
      user_id: user?.id ?? null,
      ip_address: ip,
    })
    .select('id')
    .single()

  if (dbError || !job) {
    console.error('[POST /api/scan] DB insert error:', dbError)
    return NextResponse.json(
      { error: 'Failed to create scan job. Please try again.' },
      { status: 500 }
    )
  }

  try {
    await enqueueScan({ jobId: job.id, url: safeUrl })
  } catch (queueError) {
    console.error('[POST /api/scan] Queue error:', queueError)
    await supabase
      .from('scan_jobs')
      .update({ status: 'failed' })
      .eq('id', job.id)
    return NextResponse.json(
      { error: 'Failed to queue scan. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { jobId: job.id, redirectUrl: `/scan/${job.id}` },
    { status: 201 }
  )
}
