'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export const metadata = { title: 'Upgrade — PageFlight' }

const PLANS = [
  {
    name: 'Free',
    price: { monthly: 0, annual: 0 },
    description: 'For trying it out',
    cta: 'Current plan',
    ctaDisabled: true,
    highlight: false,
    features: [
      '3 scans without sign-up',
      '5 scans / month with account',
      'All 4 checks',
      '7-day scan history',
      'Watermarked PDF export',
    ],
    missing: [
      'Bulk scanning',
      'Shareable report links',
      'Weekly monitoring',
      'Clean PDF export',
    ],
  },
  {
    name: 'Pro',
    price: { monthly: 49, annual: 39 },
    description: 'For marketers running campaigns',
    cta: 'Upgrade to Pro',
    ctaDisabled: false,
    highlight: true,
    variantId: { monthly: 'DODO_PRO_MONTHLY_VARIANT_ID', annual: 'DODO_PRO_ANNUAL_VARIANT_ID' },
    features: [
      'Unlimited scans',
      'Bulk scan (up to 10 URLs)',
      'All 5 checks incl. First Impression',
      'Permanent scan history',
      'Clean PDF export',
      'Shareable report links',
      'Priority queue',
      'Weekly monitoring + alerts',
    ],
    missing: [],
  },
  {
    name: 'Agency',
    price: { monthly: 149, annual: 119 },
    description: 'For agencies managing multiple clients',
    cta: 'Upgrade to Agency',
    ctaDisabled: false,
    highlight: false,
    variantId: { monthly: 'DODO_AGENCY_MONTHLY_VARIANT_ID', annual: 'DODO_AGENCY_ANNUAL_VARIANT_ID' },
    features: [
      'Everything in Pro',
      'Bulk scan (up to 50 URLs)',
      'Client workspaces',
      'White-label PDF export',
      'Team seats',
      'CSV export',
      'Dedicated support',
    ],
    missing: [],
  },
]

const COMPARISON_ROWS = [
  { label: 'Scans per month',         free: '5',        pro: 'Unlimited',  agency: 'Unlimited' },
  { label: 'Bulk scan',               free: '—',        pro: '10 URLs',    agency: '50 URLs' },
  { label: 'Scan history',            free: '7 days',   pro: 'Forever',    agency: 'Forever' },
  { label: 'First Impression check',  free: '✓',        pro: '✓',          agency: '✓' },
  { label: 'Adblock check',           free: '✓',        pro: '✓',          agency: '✓' },
  { label: 'Mobile check',            free: '✓',        pro: '✓',          agency: '✓' },
  { label: 'Form check',              free: '✓',        pro: '✓',          agency: '✓' },
  { label: 'SEO check',               free: '✓',        pro: '✓',          agency: '✓' },
  { label: 'PDF export',              free: 'Watermark', pro: 'Clean',     agency: 'White-label' },
  { label: 'Shareable links',         free: '—',        pro: '✓',          agency: '✓' },
  { label: 'Weekly monitoring',       free: '—',        pro: '✓',          agency: '✓' },
  { label: 'Client workspaces',       free: '—',        pro: '—',          agency: '✓' },
  { label: 'Team seats',              free: '—',        pro: '—',          agency: '✓' },
  { label: 'CSV export',             free: '—',        pro: '—',          agency: '✓' },
]

export default function UpgradePage() {
  const router = useRouter()
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(variantId: string, planName: string) {
    setLoading(planName)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Failed to start checkout. Please try again.')
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-sora font-bold text-gray-900">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Catch the issues that cost you conversions. Start free, upgrade when you need more.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2">
            <span className={`text-sm font-medium ${!annual ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(a => !a)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${annual ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? 'text-gray-900' : 'text-gray-400'}`}>
              Annual <span className="text-emerald-600 font-semibold">save 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const price = annual ? plan.price.annual : plan.price.monthly
            const variantId = 'variantId' in plan
              ? (plan.variantId as Record<string, string>)[annual ? 'annual' : 'monthly']
              : null

            return (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 flex flex-col gap-6 ${
                  plan.highlight
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]'
                    : 'bg-white border-gray-200 shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className={`font-sora font-bold text-lg ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                      {plan.name}
                    </h2>
                    {plan.highlight && (
                      <span className="text-xs font-semibold bg-white/20 text-white rounded-full px-2.5 py-0.5">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${plan.highlight ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-sora font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                      ${price}
                    </span>
                    {price > 0 && (
                      <span className={`text-sm ${plan.highlight ? 'text-indigo-200' : 'text-gray-400'}`}>/mo</span>
                    )}
                  </div>
                  {annual && price > 0 && (
                    <p className={`text-xs mt-0.5 ${plan.highlight ? 'text-indigo-200' : 'text-gray-400'}`}>
                      Billed annually
                    </p>
                  )}
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-indigo-200' : 'text-emerald-500'}`}>✓</span>
                      <span className={plan.highlight ? 'text-indigo-100' : 'text-gray-700'}>{f}</span>
                    </li>
                  ))}
                  {plan.missing.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm opacity-40">
                      <span className="mt-0.5 shrink-0">—</span>
                      <span className={plan.highlight ? 'text-indigo-100' : 'text-gray-500'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={plan.ctaDisabled || loading === plan.name}
                  onClick={() => variantId && handleCheckout(variantId, plan.name)}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    plan.highlight
                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                      : plan.ctaDisabled
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {loading === plan.name ? 'Loading…' : plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-sora font-bold text-gray-900">Full comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-gray-500 font-medium w-1/2">Feature</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Free</th>
                  <th className="text-center px-4 py-3 text-indigo-600 font-semibold">Pro</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium">Agency</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={row.label} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-3 text-gray-700 font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{row.free}</td>
                    <td className="px-4 py-3 text-center text-indigo-600 font-medium">{row.pro}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{row.agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ / reassurance */}
        <p className="text-center text-sm text-gray-400">
          All plans include a 7-day money-back guarantee. Cancel anytime. Prices in USD.
        </p>
      </div>
    </main>
  )
}
