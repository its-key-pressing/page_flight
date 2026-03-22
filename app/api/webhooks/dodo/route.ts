import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

// Service-role client — no cookie auth needed for webhooks
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Map Dodo variant IDs → plan names
// Replace these with your real variant IDs from the Dodo dashboard
const VARIANT_TO_PLAN: Record<string, 'pro' | 'agency'> = {
  DODO_PRO_MONTHLY_VARIANT_ID:    'pro',
  DODO_PRO_ANNUAL_VARIANT_ID:     'pro',
  DODO_AGENCY_MONTHLY_VARIANT_ID: 'agency',
  DODO_AGENCY_ANNUAL_VARIANT_ID:  'agency',
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex')
  // Constant-time comparison
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * POST /api/webhooks/dodo
 *
 * Handles Dodo Payments webhook events.
 * Configure this URL in your Dodo dashboard → Webhooks.
 *
 * Events handled:
 *   subscription.created / payment.succeeded → set plan
 *   subscription.cancelled / subscription.expired → revert to free
 */
export async function POST(request: NextRequest) {
  const secret = process.env.DODO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook/dodo] DODO_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature =
    request.headers.get('dodo-signature') ??
    request.headers.get('x-dodo-signature') ??
    ''

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn('[webhook/dodo] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = event.type as string
  const data = (event.data ?? event) as Record<string, unknown>

  console.log(`[webhook/dodo] Event: ${type}`)

  // Upgrade events
  if (
    type === 'subscription.created' ||
    type === 'subscription.renewed' ||
    type === 'payment.succeeded'
  ) {
    const variantId =
      (data.product_id as string) ??
      (data.variant_id as string) ??
      ''
    const customerId =
      (data.customer_id as string) ??
      ((data.customer as Record<string, unknown>)?.id as string) ??
      ''
    const supabaseUserId =
      (data.metadata as Record<string, string>)?.supabase_user_id ?? ''
    const plan = VARIANT_TO_PLAN[variantId]

    if (!plan) {
      console.warn(`[webhook/dodo] Unknown variant ID: ${variantId}`)
      return NextResponse.json({ received: true })
    }

    if (!supabaseUserId) {
      console.error('[webhook/dodo] No supabase_user_id in metadata')
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('users')
      .upsert(
        { id: supabaseUserId, plan, dodo_customer_id: customerId },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('[webhook/dodo] Supabase update error:', error)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    console.log(`[webhook/dodo] User upgraded to ${plan}`)
  }

  // Cancellation / expiry events
  if (
    type === 'subscription.cancelled' ||
    type === 'subscription.expired' ||
    type === 'subscription.paused'
  ) {
    const supabaseUserId =
      (data.metadata as Record<string, string>)?.supabase_user_id ?? ''

    if (!supabaseUserId) {
      console.error('[webhook/dodo] No supabase_user_id in metadata for cancellation')
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('users')
      .update({ plan: 'free' })
      .eq('id', supabaseUserId)

    if (error) {
      console.error('[webhook/dodo] Supabase downgrade error:', error)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    console.log('[webhook/dodo] User reverted to free plan')
  }

  return NextResponse.json({ received: true })
}
