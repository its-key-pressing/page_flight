import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dashboard — PageFlight' }

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  queued:    { label: 'Queued',    classes: 'bg-gray-100 text-gray-600' },
  running:   { label: 'Running',   classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', classes: 'bg-emerald-100 text-emerald-700' },
  failed:    { label: 'Failed',    classes: 'bg-red-100 text-red-700' },
}

const CHECK_ICONS: Record<string, { icon: string; label: string }> = {
  adblock: { icon: '🛡️', label: 'Adblock' },
  mobile:  { icon: '📱', label: 'Mobile' },
  form:    { icon: '📋', label: 'Form' },
  seo:     { icon: '🔍', label: 'SEO' },
}

const CHECK_ORDER = ['adblock', 'mobile', 'form', 'seo']

function getFavicon(url: string) {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return null
  }
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: scans } = await supabase
    .from('scan_jobs')
    .select('id, url, status, created_at, scan_results(check_type, passed)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const scanList = scans ?? []

  // Quick stats
  const totalScans = scanList.length
  const completedScans = scanList.filter(s => s.status === 'completed')
  const pagesWithIssues = completedScans.filter(s => {
    const results = (s.scan_results as { passed: boolean }[]) ?? []
    return results.some(r => !r.passed)
  }).length
  const cleanPages = completedScans.length - pagesWithIssues

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-sora font-bold text-gray-900">Your Scans</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>

        {/* Stats bar */}
        {totalScans > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total scans', value: totalScans },
              { label: 'Pages with issues', value: pagesWithIssues, warn: pagesWithIssues > 0 },
              { label: 'Clean pages', value: cleanPages, good: cleanPages > 0 },
            ].map(({ label, value, warn, good }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                <p className={`text-2xl font-sora font-bold ${warn ? 'text-red-500' : good ? 'text-emerald-500' : 'text-gray-900'}`}>
                  {value}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Scan list */}
        {scanList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-20 px-6 space-y-4">
            <div className="text-5xl">🚀</div>
            <h2 className="text-xl font-sora font-bold text-gray-900">No scans yet</h2>
            <p className="text-gray-500 max-w-sm mx-auto text-sm">
              Run your first audit to see how your landing page looks to real visitors — with adblock, on mobile, under real conditions.
            </p>
            <a href="/" className="btn-primary inline-block mt-2">
              Scan your first page
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {scanList.map((scan) => {
              const results = (scan.scan_results as { check_type: string; passed: boolean }[]) ?? []
              const passed = results.filter(r => r.passed).length
              const total = results.length
              const badge = STATUS_BADGE[scan.status] ?? STATUS_BADGE.queued
              const favicon = getFavicon(scan.url)
              const domain = getDomain(scan.url)
              const date = new Date(scan.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              const isCompleted = scan.status === 'completed'
              const isActive = scan.status === 'running' || scan.status === 'queued'

              const resultsByType = Object.fromEntries(results.map(r => [r.check_type, r.passed]))

              return (
                <div
                  key={scan.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:border-indigo-100 hover:shadow-md transition-all"
                >
                  {/* Favicon */}
                  <div className="shrink-0 h-9 w-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                    {favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={favicon} alt={domain} width={20} height={20} className="rounded" />
                    ) : (
                      <span className="text-gray-300 text-lg">🌐</span>
                    )}
                  </div>

                  {/* URL + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{domain}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{date}</p>
                  </div>

                  {/* Per-check icons (completed only) */}
                  {isCompleted && total > 0 && (
                    <div className="hidden sm:flex items-center gap-2">
                      {CHECK_ORDER.map(type => {
                        const checkPassed = resultsByType[type]
                        return (
                          <div
                            key={type}
                            title={`${CHECK_ICONS[type].label}: ${checkPassed === undefined ? 'N/A' : checkPassed ? 'Passed' : 'Failed'}`}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              checkPassed === true
                                ? 'bg-emerald-50 text-emerald-600'
                                : checkPassed === false
                                ? 'bg-red-50 text-red-600'
                                : 'bg-gray-50 text-gray-400'
                            }`}
                          >
                            <span className="text-sm">{CHECK_ICONS[type].icon}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Score badge */}
                  {isCompleted && total > 0 && (
                    <div className={`shrink-0 text-sm font-sora font-bold px-3 py-1 rounded-full ${
                      passed === total ? 'bg-emerald-50 text-emerald-600' :
                      passed >= total / 2 ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {passed}/{total}
                    </div>
                  )}

                  {/* Status badge (non-completed) */}
                  {!isCompleted && (
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.classes}`}>
                      {badge.label}
                    </span>
                  )}

                  {/* Action link */}
                  <a
                    href={isCompleted ? `/results/${scan.id}` : isActive ? `/scan/${scan.id}` : '#'}
                    className={`shrink-0 text-sm font-medium transition-colors ${
                      isCompleted || isActive
                        ? 'text-indigo-600 hover:text-indigo-800'
                        : 'text-gray-300 cursor-default'
                    }`}
                  >
                    {isCompleted ? 'View →' : isActive ? 'Progress →' : '—'}
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
