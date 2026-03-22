'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ScanStatusResponse } from '@/lib/types'

const CHECKS = [
  { type: 'adblock', icon: '🛡️', label: 'Adblock filter test',  desc: 'Simulating EasyList cosmetic filters' },
  { type: 'mobile',  icon: '📱', label: 'Mobile layout',         desc: 'Testing at 375px viewport' },
  { type: 'form',    icon: '📋', label: 'Form functionality',    desc: 'Filling and submitting forms' },
  { type: 'seo',     icon: '🔍', label: 'SEO basics',            desc: 'Checking H1, title, description' },
]

function CheckRow({ icon, label, desc, status }: {
  icon: string
  label: string
  desc: string
  status: string
}) {
  const isRunning = status === 'running'
  const isPassed  = status === 'passed'
  const isFailed  = status === 'failed'
  const isDone    = isPassed || isFailed

  return (
    <div className={`flex items-center gap-4 rounded-xl px-4 py-3.5 border transition-all ${
      isRunning ? 'border-indigo-200 bg-indigo-50/50' :
      isPassed  ? 'border-emerald-100 bg-emerald-50/30' :
      isFailed  ? 'border-red-100 bg-red-50/30' :
      'border-gray-100 bg-white'
    }`}>
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isRunning ? 'text-indigo-900' : 'text-gray-800'}`}>
          {label}
        </p>
        {isRunning && (
          <p className="text-xs text-indigo-500 mt-0.5 animate-pulse">{desc}…</p>
        )}
      </div>
      <div className="shrink-0 w-6 text-center">
        {isRunning && (
          <svg className="h-5 w-5 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {isPassed && (
          <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {isFailed && (
          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {!isDone && !isRunning && (
          <span className="h-3 w-3 rounded-full border-2 border-gray-200 inline-block" />
        )}
      </div>
    </div>
  )
}

export default function ScanProgressPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [data, setData] = useState<ScanStatusResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stopped = false

    async function poll() {
      try {
        const res = await fetch(`/api/scan/${params.id}/status`)
        if (!res.ok) { setError('Scan not found.'); return }
        const json: ScanStatusResponse = await res.json()
        if (!stopped) setData(json)

        if (json.status === 'completed' && json.resultsUrl) {
          router.push(json.resultsUrl); return
        }
        if (json.status === 'failed') {
          setError('The scan failed. Please try again.'); return
        }
        if (!stopped) setTimeout(poll, 2000)
      } catch {
        if (!stopped) setError('Lost connection. Please refresh.')
      }
    }

    poll()
    return () => { stopped = true }
  }, [params.id, router])

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <p className="text-gray-800 font-medium">{error}</p>
          <a href="/" className="btn-primary inline-block">Try again</a>
        </div>
      </main>
    )
  }

  const checkStatuses = Object.fromEntries(
    (data?.checks ?? []).map(c => [c.type, c.status])
  )

  const doneCount = (data?.checks ?? []).filter(c => c.status === 'passed' || c.status === 'failed').length

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md space-y-4">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-2">
          <h1 className="text-xl font-sora font-bold text-gray-900">
            Auditing your page…
          </h1>
          {data?.url && (
            <p className="text-sm text-gray-400 truncate">{data.url}</p>
          )}
          {data && (
            <p className="text-xs text-gray-400">{doneCount} of 4 checks complete</p>
          )}
        </div>

        {/* Check rows */}
        <div className="space-y-2">
          {CHECKS.map(check => (
            <CheckRow
              key={check.type}
              icon={check.icon}
              label={check.label}
              desc={check.desc}
              status={checkStatuses[check.type] ?? 'waiting'}
            />
          ))}
        </div>

        {!data && (
          <p className="text-center text-sm text-gray-400 animate-pulse">
            Connecting to worker…
          </p>
        )}

        <p className="text-center text-xs text-gray-400 pt-2">
          Results usually take 20–40 seconds
        </p>
      </div>
    </main>
  )
}
