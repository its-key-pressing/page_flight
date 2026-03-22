import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ScanStatusResponse, CheckType } from '@/lib/types'

const CHECK_ORDER: CheckType[] = ['adblock', 'mobile', 'form', 'seo']

/**
 * GET /api/scan/[id]/status
 *
 * Polled every 2 seconds by the /scan/[id] progress page.
 * Returns the current job status and per-check progress.
 *
 * Returns: ScanStatusResponse
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Missing scan id' }, { status: 400 })
  }

  const supabase = createClient()

  // Fetch the job
  const { data: job, error: jobError } = await supabase
    .from('scan_jobs')
    .select('id, url, status, created_at, completed_at')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
  }

  // Fetch completed check results (if any)
  const { data: results } = await supabase
    .from('scan_results')
    .select('check_type, passed')
    .eq('job_id', id)

  const completedChecks = new Map(
    (results ?? []).map((r) => [r.check_type as CheckType, r.passed as boolean])
  )

  // Build per-check status
  const checks = CHECK_ORDER.map((type) => {
    if (completedChecks.has(type)) {
      return {
        type,
        status: completedChecks.get(type) ? ('passed' as const) : ('failed' as const),
      }
    }
    if (job.status === 'running') {
      // The first check not yet in results is the one currently running
      const firstPending = CHECK_ORDER.find((t) => !completedChecks.has(t))
      return {
        type,
        status: type === firstPending ? ('running' as const) : ('waiting' as const),
      }
    }
    return { type, status: 'waiting' as const }
  })

  const response: ScanStatusResponse = {
    jobId: job.id,
    status: job.status,
    url: job.url,
    checks,
    ...(job.status === 'completed' && { resultsUrl: `/results/${job.id}` }),
  }

  return NextResponse.json(response)
}
