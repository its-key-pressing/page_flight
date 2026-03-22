import type { Page } from 'playwright'
import type { CheckIssue } from '../../lib/types'

/**
 * First Impression check
 *
 * Captures what a visitor sees in the first 3 seconds:
 * - Desktop + mobile screenshots on load (no interaction)
 * - CTA visible above the fold?
 * - Fixed/sticky overlay covering >40% of viewport?
 * - Video element blocked/unloaded?
 * - Full-screen overlay on mobile?
 */
export async function runFirstImpressionCheck(
  page: Page,
  url: string
): Promise<{ passed: boolean; issues: CheckIssue[]; screenshots: Record<string, string> }> {
  const issues: CheckIssue[] = []
  const screenshots: Record<string, string> = {}

  // ── Desktop screenshot (1280×800) ──────────────────────────────────────────
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(1000)

  const desktopShot = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false })
  screenshots.desktop = desktopShot.toString('base64')

  // ── Check for CTA above the fold (desktop) ─────────────────────────────────
  const hasCTAAboveFold = await page.evaluate(() => {
    const viewportHeight = window.innerHeight
    const actionTexts = [
      'get started', 'start', 'try', 'sign up', 'signup', 'register',
      'buy', 'purchase', 'order', 'book', 'schedule', 'request',
      'learn more', 'see how', 'watch', 'demo', 'free trial', 'get free',
      'download', 'install', 'join', 'contact', 'claim',
    ]

    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('a, button, [role="button"], input[type="submit"]')
    )

    return buttons.some(el => {
      const rect = el.getBoundingClientRect()
      if (rect.top > viewportHeight || rect.bottom < 0) return false
      if (rect.width === 0 || rect.height === 0) return false

      const text = (el.textContent ?? '').toLowerCase().trim()
      return actionTexts.some(action => text.includes(action))
    })
  })

  if (!hasCTAAboveFold) {
    issues.push({
      description: 'No clear call-to-action (CTA) button is visible above the fold on desktop.',
      fix: 'Add a prominent action button (e.g. "Get started", "Try free", "Book a demo") in the hero section so it\'s immediately visible without scrolling.',
    })
  }

  // ── Check for large fixed overlay (desktop) ────────────────────────────────
  const overlayInfo = await page.evaluate(() => {
    const viewportArea = window.innerWidth * window.innerHeight
    const fixed = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(el => {
      const style = window.getComputedStyle(el)
      return (style.position === 'fixed' || style.position === 'sticky') &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0.1
    })

    for (const el of fixed) {
      const rect = el.getBoundingClientRect()
      const area = rect.width * rect.height
      const ratio = area / viewportArea
      if (ratio > 0.4) {
        return {
          found: true,
          ratio: Math.round(ratio * 100),
          selector: el.tagName.toLowerCase() +
            (el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : ''),
        }
      }
    }
    return { found: false, ratio: 0, selector: '' }
  })

  if (overlayInfo.found) {
    issues.push({
      selector: overlayInfo.selector,
      description: `A fixed overlay covers ~${overlayInfo.ratio}% of the viewport, blocking your content from the first moment.`,
      fix: 'Reduce the overlay size, delay its appearance by 3–5 seconds, or replace it with a less intrusive banner. Visitors who arrived from paid ads are especially likely to bounce immediately.',
    })
  }

  // ── Check for unloaded video ───────────────────────────────────────────────
  const hasBlockedVideo = await page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
    return videos.some(v => {
      const rect = v.getBoundingClientRect()
      if (rect.top > window.innerHeight) return false
      return v.readyState === 0 && !v.autoplay
    })
  })

  if (hasBlockedVideo) {
    issues.push({
      description: 'A video element above the fold appears unloaded or blocked.',
      fix: 'Add a poster image as a fallback, ensure the video URL is publicly accessible, and avoid relying on autoplay (blocked by most browsers). Use a thumbnail with a play button overlay instead.',
    })
  }

  // ── Mobile screenshot + full-screen overlay check (375×812) ───────────────
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(1000)

  const mobileShot = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false })
  screenshots.mobile = mobileShot.toString('base64')

  const mobileOverlay = await page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const viewportArea = vw * vh

    const fixed = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(el => {
      const style = window.getComputedStyle(el)
      return (style.position === 'fixed' || style.position === 'sticky') &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0.1
    })

    for (const el of fixed) {
      const rect = el.getBoundingClientRect()
      const area = rect.width * rect.height
      const ratio = area / viewportArea
      if (ratio > 0.7) {
        return {
          found: true,
          ratio: Math.round(ratio * 100),
          selector: el.tagName.toLowerCase() +
            (el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : ''),
        }
      }
    }
    return { found: false, ratio: 0, selector: '' }
  })

  if (mobileOverlay.found) {
    issues.push({
      selector: mobileOverlay.selector,
      description: `On mobile, a fixed overlay covers ~${mobileOverlay.ratio}% of the screen — effectively a full-screen takeover on first load.`,
      fix: 'On mobile viewports, use a bottom sheet or banner instead of a full-screen overlay. Mobile visitors from paid ads will almost universally bounce when they can\'t see the page they clicked to reach.',
    })
  }

  // Restore desktop viewport for subsequent checks
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

  const passed = issues.length === 0
  return { passed, issues, screenshots }
}
