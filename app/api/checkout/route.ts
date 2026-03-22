import { NextRequest, NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const dodo = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: (process.env.DODO_ENV ?? 'test_mode') as 'test_mode' | 'live_mode',
  })
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to upgrade.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const variantId = (body as Record<string, unknown>).variantId
  // Validate format — Dodo product IDs are alphanumeric with underscores/hyphens
  if (typeof variantId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(variantId)) {
    return NextResponse.json({ error: 'Invalid variantId.' }, { status: 400 })
  }

  try {
    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: variantId, quantity: 1 }],
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
      customer: { email: user.email! },
      metadata: { supabase_user_id: user.id },
    })

    return NextResponse.json({ checkoutUrl: session.checkout_url })
  } catch (err) {
    console.error('[checkout] Dodo Payments error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 })
  }
}
