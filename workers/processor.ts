import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import type { ScanJobPayload, CheckType } from '../lib/types'
import { runFirstImpressionCheck } from './checks/first-impression'
import { runAdblockCheck } from './checks/adblock'
import { runMobileCheck } from './checks/mobile'
import { runFormCheck } from './checks/form'
import { runSeoCheck } from './checks/seo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Attempts to dismiss cookie consent / GDPR banners before running checks.
 * Returns true if a banner was found and dismissed, false otherwise.
 */
async function dismissCookieBanner(page: import('playwright').Page): Promise<boolean> {
  // Common accept button selectors (ordered by specificity)
  const SELECTORS = [
    '#onetrust-accept-btn-handler',
    '.cc-accept',
    '.cc-allow',
    '.cc-btn-accept',
    '[id*="accept-all"]',
    '[class*="accept-all"]',
    '[aria-label*="accept" i]',
    '[aria-label*="allow" i]',
    '[aria-label*="agree" i]',
  ]

  // Try selector-based dismissal first
  for (const selector of SELECTORS) {
    try {
      const btn = page.locator(selector).first()
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click()
        await page.waitForTimeout(800)
        console.log(`[processor] Dismissed cookie banner via selector: ${selector}`)
        return true
      }
    } catch {
      // Selector not found — try next
    }
  }

  // Text-based fallback: find buttons with common accept text
  const acceptTexts = [
    'Accept All', 'Accept all', 'Accept', 'Allow all', 'Allow All',
    'I agree', 'I Agree', 'Got it', 'OK', 'Ok', 'Okay',
    'Continue', 'Allow cookies', 'Allow Cookies',
  ]

  for (const text of acceptTexts) {
    try {
      const btn = page.getByRole('button', { name: text, exact: true }).first()
      if (await btn.isVisible({ timeout: 300 })) {
        await btn.click()
        await page.waitForTimeout(800)
        console.log(`[processor] Dismissed cookie banner via text: "${text}"`)
        return true
      }
    } catch {
      // Not found — try next
    }
  }

  // Last resort: close button on any overlay
  try {
    const closeBtn = page.locator('[aria-label*="close" i], [aria-label*="dismiss" i]').first()
    if (await closeBtn.isVisible({ timeout: 300 })) {
      await closeBtn.click()
      await page.waitForTimeout(800)
      console.log('[processor] Dismissed overlay via close/dismiss button')
      return true
    }
  } catch {
    // No close button found
  }

  return false
}

/**
 * Main job processor.
 * Runs all 5 checks sequentially (sequential for progress UX).
 *
 * Order:
 *   1. first_impression — screenshots + overlay/CTA check on clean load
 *   2. Cookie banner dismissal (before remaining checks)
 *   3. adblock, mobile, form, seo — on clean DOM
 */
export async function processJob(payload: ScanJobPayload): Promise<void> {
  const { jobId, url } = payload

  await supabase
    .from('scan_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)

  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })

    const page = await context.newPage()

    // Initial load
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

    const checks: Array<{
      type: CheckType
      runner: () => Promise<{
        passed: boolean
        issues: unknown[]
        screenshots: unknown
      }>
    }> = [
      // 1. First impression — clean load, no interaction
      { type: 'first_impression', runner: () => runFirstImpressionCheck(page, url) },

      // After first_impression, attempt to dismiss cookie banners
      // then run the remaining checks on clean DOM.
      // We insert the dismissal as a side-effect before adblock runs.
      { type: 'adblock', runner: async () => {
          // Dismiss banner before adblock (and subsequent) checks
          const dismissed = await dismissCookieBanner(page)
          if (!dismissed) {
            console.log('[processor] No cookie banner detected — continuing.')
          }
          return runAdblockCheck(page, url)
        }
      },
      { type: 'mobile',  runner: () => runMobileCheck(page, url) },
      { type: 'form',    runner: () => runFormCheck(page, url) },
      { type: 'seo',     runner: () => runSeoCheck(page, url) },
    ]

    for (const { type, runner } of checks) {
      try {
        const result = await runner()
        await supabase.from('scan_results').insert({
          job_id: jobId,
          check_type: type,
          passed: result.passed,
          issues: result.issues,
          screenshots: result.screenshots,
        })
      } catch (checkError) {
        console.error(`[worker] Check "${type}" failed for ${url}:`, checkError)
        await supabase.from('scan_results').insert({
          job_id: jobId,
          check_type: type,
          passed: false,
          issues: [
            {
              description: 'Check errored during scan.',
              fix: 'Re-run the scan. If the problem persists, check the URL is publicly accessible.',
            },
          ],
          screenshots: {},
        })
      }
    }

    await context.close()

    await supabase
      .from('scan_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', jobId)
  } catch (err) {
    console.error(`[worker] Fatal error for job ${jobId}:`, err)
    await supabase
      .from('scan_jobs')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', jobId)
    throw err
  } finally {
    await browser.close()
  }
}
