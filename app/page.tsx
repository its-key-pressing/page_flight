'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ANON_SCAN_KEY = 'pf_anon_scans'
const ANON_SCAN_LIMIT = 3

function getAnonScanCount(): number {
  try {
    return parseInt(localStorage.getItem(ANON_SCAN_KEY) ?? '0', 10)
  } catch {
    return 0
  }
}

function incrementAnonScanCount() {
  try {
    localStorage.setItem(ANON_SCAN_KEY, String(getAnonScanCount() + 1))
  } catch {
    // localStorage unavailable — silently allow
  }
}

const CHECKS = [
  {
    icon: '🛡️',
    title: 'Adblock filter test',
    description:
      'Simulates EasyList cosmetic filters. Finds elements hidden from the ~40% of visitors running adblock — before you pay for a single click.',
    color: 'bg-indigo-50 text-indigo-700',
  },
  {
    icon: '📱',
    title: 'Mobile layout',
    description:
      'Loads your page at 375px and checks for horizontal overflow, broken layouts, and tap targets too small to click comfortably.',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    icon: '📋',
    title: 'Form functionality',
    description:
      'Fills and submits your lead capture form, then checks whether a success confirmation actually appears. No silent failures.',
    color: 'bg-purple-50 text-purple-700',
  },
  {
    icon: '🔍',
    title: 'SEO basics',
    description:
      'Checks H1 tags, meta title length, and meta description — the fundamentals that affect your Quality Score and organic rankings.',
    color: 'bg-emerald-50 text-emerald-700',
  },
]

export default function HomePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const count = getAnonScanCount()
    if (count >= ANON_SCAN_LIMIT) {
      router.push('/signup?reason=limit')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (res.status === 429) {
        if (data.upgradeUrl) {
          router.push(data.upgradeUrl)
        } else {
          router.push('/signup?reason=limit')
        }
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      incrementAnonScanCount()
      router.push(data.redirectUrl)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-6 py-20 text-center">
        <div className="w-full max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            Free audit · No sign-up required
          </div>

          <h1 className="text-5xl font-sora font-bold text-gray-900 tracking-tight leading-tight">
            Is your landing page broken<br className="hidden sm:block" /> for real visitors?
          </h1>

          <p className="text-xl text-gray-500 max-w-lg mx-auto">
            Test with adblock enabled, on mobile, under real conditions.
            Catch invisible issues before you spend on ads.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourpage.com"
              required
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900
                         placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-[#4F46E5] shadow-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !url}
              className="btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Starting…' : 'Run free audit'}
            </button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <p className="text-sm text-gray-400">
            Results in ~30 seconds · No credit card · 3 free scans
          </p>
        </div>
      </section>

      {/* What we check */}
      <section className="bg-white border-t border-gray-100 px-6 py-20">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-sora font-bold text-gray-900">
              4 checks. Every scan.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              We test the things that silently kill conversion — the issues
              your own browser would never show you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {CHECKS.map((check) => (
              <div key={check.title} className="card space-y-3">
                <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl text-xl ${check.color}`}>
                  {check.icon}
                </div>
                <h3 className="font-sora font-semibold text-gray-900">{check.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{check.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl font-sora font-bold text-gray-900">
            Ready to find out what you&apos;re missing?
          </h2>
          <p className="text-gray-500">Free to start. No account needed.</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="btn-primary"
          >
            Run a free audit
          </button>
        </div>
      </section>
    </main>
  )
}
