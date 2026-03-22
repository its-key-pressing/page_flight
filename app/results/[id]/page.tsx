import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { CheckIssue, CheckType } from '@/lib/types'
import { notFound } from 'next/navigation'
import { ShareButton, RescanButton } from './ResultActions'

export const metadata: Metadata = { title: 'Audit Results — PageFlight' }

const CHECK_LABELS: Record<CheckType, string> = {
  adblock: 'Adblock Filter Test',
  mobile:  'Mobile Layout',
  form:    'Form Functionality',
  seo:     'SEO Basics',
}

const CHECK_ICONS: Record<CheckType, string> = {
  adblock: '🛡️',
  mobile:  '📱',
  form:    '📋',
  seo:     '🔍',
}

const CHECK_META: Record<CheckType, { severity: string; severityColor: string; impact: string }> = {
  adblock: {
    severity: 'Critical',
    severityColor: 'bg-red-50 text-red-700',
    impact: 'Up to 40% of visitors run adblock. If your offer, CTA, or hero is hidden, they never see it — and you still paid for the click.',
  },
  mobile: {
    severity: 'High',
    severityColor: 'bg-orange-50 text-orange-700',
    impact: 'Most paid traffic is mobile. Layout issues and small tap targets directly increase bounce rate and cost per conversion.',
  },
  form: {
    severity: 'Critical',
    severityColor: 'bg-red-50 text-red-700',
    impact: 'Silent form failures mean lost leads. Visitors submit and see nothing — many assume it worked and never follow up.',
  },
  seo: {
    severity: 'Medium',
    severityColor: 'bg-yellow-50 text-yellow-700',
    impact: 'Missing or malformed meta tags hurt your Google Ads Quality Score and organic rankings, raising your cost per click over time.',
  },
}

const SCREENSHOT_LABELS: Record<string, string> = {
  clean:    'Normal view',
  filtered: 'With adblock active',
  mobile:   'Mobile (375px)',
  before:   'Before submit',
  after:    'After submit',
}

interface ScanResultRow {
  check_type: CheckType
  passed: boolean
  issues: CheckIssue[]
  screenshots: Record<string, string> | null
}

export default async function ResultsPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: job } = await supabase
    .from('scan_jobs')
    .select('id, url, status, created_at, user_id')
    .eq('id', params.id)
    .single()

  if (!job || job.status !== 'completed') notFound()

  const { data: results } = await supabase
    .from('scan_results')
    .select('check_type, passed, issues, screenshots')
    .eq('job_id', params.id)

  const { data: { user } } = await supabase.auth.getUser()
  const isAnonymous = !user

  const rows: ScanResultRow[] = results ?? []
  const passed = rows.filter((r) => r.passed).length
  const total = rows.length
  const failed = total - passed
  const allPassed = passed === total && total > 0

  const scanDate = new Date(job.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pageflight.io'}/results/${params.id}`

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-6 pt-10 space-y-8">

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-sora font-bold text-gray-900">Audit Results</h1>
              <p className="text-sm text-gray-500 mt-1 truncate">{job.url}</p>
              <p className="text-xs text-gray-400 mt-0.5">Scanned {scanDate}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ShareButton url={shareUrl} />
            </div>
          </div>
        </div>

        {/* Score summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-6">
            <div className="text-center shrink-0">
              <p className={`text-5xl font-sora font-bold ${allPassed ? 'text-emerald-500' : failed >= 3 ? 'text-red-500' : 'text-[#4F46E5]'}`}>
                {passed}/{total}
              </p>
              <p className="text-sm text-gray-500 mt-1">checks passed</p>
            </div>
            <div className="flex-1 space-y-3">
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allPassed ? 'bg-emerald-500' : failed >= 3 ? 'bg-red-500' : 'bg-[#4F46E5]'}`}
                  style={{ width: total > 0 ? `${(passed / total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {allPassed
                  ? '✅ No issues found — your page looks great to real visitors!'
                  : failed === 1
                  ? '1 issue found that could be affecting conversions.'
                  : `${failed} issues found that could be costing you conversions.`}
              </p>
              {!isAnonymous && (
                <RescanButton scanUrl={job.url} />
              )}
            </div>
          </div>
        </div>

        {/* Per-check cards */}
        <div className="space-y-4">
          {rows.map((result) => {
            const meta = CHECK_META[result.check_type]
            const screenshots = result.screenshots ?? {}
            const screenshotEntries = Object.entries(screenshots).filter(([, v]) => !!v)

            return (
              <div
                key={result.check_type}
                className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${result.passed ? 'border-l-emerald-400' : 'border-l-red-400'}`}
              >
                <div className="p-5 space-y-4">
                  {/* Check header */}
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CHECK_ICONS[result.check_type]}</span>
                    <h2 className="flex-1 font-sora font-semibold text-gray-900">
                      {CHECK_LABELS[result.check_type]}
                    </h2>
                    {!result.passed && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${meta.severityColor}`}>
                        {meta.severity}
                      </span>
                    )}
                    {result.passed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Passed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Impact note (failed only) */}
                  {!result.passed && (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-sm text-amber-800">
                      <span className="font-medium">Why it matters: </span>
                      {meta.impact}
                    </div>
                  )}

                  {/* Issues list */}
                  {result.issues.length > 0 && (
                    <ul className="space-y-2 border-t border-gray-100 pt-3">
                      {result.issues.map((issue, i) => (
                        <li key={i} className="rounded-lg bg-gray-50 px-4 py-3 text-sm space-y-1">
                          <p className="font-medium text-gray-800">{issue.description}</p>
                          <p className="text-gray-500">
                            <span className="font-medium text-[#4F46E5]">Fix: </span>
                            {issue.fix}
                          </p>
                          {issue.selector && (
                            <p className="font-mono text-xs text-gray-400 mt-1 bg-white rounded px-2 py-1 border border-gray-100 inline-block">
                              {issue.selector}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Screenshots */}
                  {screenshotEntries.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 space-y-3">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Screenshots</p>
                      <div className={`grid gap-3 ${screenshotEntries.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {screenshotEntries.map(([key, src]) => (
                          <div key={key} className="space-y-1.5">
                            <p className="text-xs text-gray-500 font-medium">
                              {SCREENSHOT_LABELS[key] ?? key}
                            </p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src.startsWith('data:') ? src : `data:image/jpeg;base64,${src}`}
                              alt={SCREENSHOT_LABELS[key] ?? key}
                              className="w-full rounded-lg border border-gray-100 shadow-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Signup CTA for anonymous users */}
        {isAnonymous && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6 text-center space-y-4">
            <div className="space-y-2">
              <h3 className="font-sora font-bold text-gray-900 text-lg">
                Save your results & track changes over time
              </h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                Create a free account to keep your audit history, re-scan after fixing issues,
                and catch regressions before they cost you conversions.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/signup" className="btn-primary">
                Create free account
              </a>
              <a
                href="/"
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Run another audit
              </a>
            </div>
          </div>
        )}

        {/* Signed-in bottom actions */}
        {!isAnonymous && (
          <div className="flex flex-col sm:flex-row gap-3 pb-4">
            <a href="/" className="btn-primary text-center">
              Run another audit
            </a>
            <a
              href="/dashboard"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
            >
              Back to dashboard
            </a>
          </div>
        )}

        {/* Public footer CTA */}
        <div className="border-t border-gray-100 pt-6 text-center space-y-1">
          <p className="text-sm text-gray-500">
            Report generated by{' '}
            <a href="/" className="text-[#4F46E5] font-medium hover:underline">PageFlight</a>
          </p>
          <p className="text-xs text-gray-400">
            Test your own landing page free — adblock, mobile, forms & SEO in one scan.
          </p>
        </div>

      </div>
    </main>
  )
}
