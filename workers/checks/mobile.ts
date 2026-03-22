import type { Page } from 'playwright'
import type { CheckIssue } from '../../lib/types'

export interface MobileCheckResult {
  passed: boolean
  issues: CheckIssue[]
  screenshots: {
    mobile?: string
  }
}

export async function runMobileCheck(page: Page, url: string): Promise<MobileCheckResult> {
  const issues: CheckIssue[] = []

  // Resize to mobile and reload clean (adblock check injected CSS on the previous load)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

  // Check for horizontal overflow
  const overflowData = await page.evaluate(() => {
    const bodyScrollWidth = document.body.scrollWidth
    const viewportWidth = window.innerWidth

    // Find top offending elements extending past the right edge
    const offscreen: Array<{ selector: string; right: number }> = []
    const all = document.querySelectorAll('*')

    for (const el of Array.from(all)) {
      const rect = el.getBoundingClientRect()
      if (rect.right > viewportWidth + 5 && rect.width > 0 && rect.height > 0) {
        const tag = el.tagName.toLowerCase()
        const id = el.id ? `#${el.id}` : ''
        const cls = typeof el.className === 'string' && el.className
          ? `.${el.className.trim().split(/\s+/)[0]}`
          : ''
        offscreen.push({ selector: `${tag}${id || cls}`, right: Math.round(rect.right) })
        if (offscreen.length >= 3) break
      }
    }

    return { bodyScrollWidth, viewportWidth, offscreen }
  })

  if (overflowData.bodyScrollWidth > overflowData.viewportWidth + 5) {
    issues.push({
      description: `Page has horizontal overflow at 375px — body is ${overflowData.bodyScrollWidth}px wide.`,
      fix: 'Add `overflow-x: hidden` to the body, or find elements with fixed widths wider than the viewport and replace them with `max-width: 100%`.',
      value: `Body width: ${overflowData.bodyScrollWidth}px (viewport: ${overflowData.viewportWidth}px)`,
    })

    for (const el of overflowData.offscreen) {
      issues.push({
        selector: el.selector,
        description: `Element extends to ${el.right}px — ${el.right - overflowData.viewportWidth}px beyond the right edge.`,
        fix: 'Use `max-width: 100%` or responsive units (%, vw) instead of fixed pixel widths.',
        value: `Right edge at ${el.right}px`,
      })
    }
  }

  // Check for tap targets that are too small (< 44×44px — Google's recommendation)
  const smallTargets = await page.evaluate(() => {
    const selectors = 'a, button, [role="button"], input[type="submit"], input[type="button"]'
    const results: Array<{ selector: string; size: string }> = []

    for (const el of Array.from(document.querySelectorAll(selectors))) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
        const tag = el.tagName.toLowerCase()
        const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : ''
        const text = el.textContent?.trim().slice(0, 30) ?? ''
        results.push({
          selector: id ? `${tag}${id}` : `${tag}${text ? `[text="${text}"]` : ''}`,
          size: `${Math.round(rect.width)}×${Math.round(rect.height)}px`,
        })
        if (results.length >= 3) break
      }
    }
    return results
  })

  for (const el of smallTargets) {
    issues.push({
      selector: el.selector,
      description: `Tap target is too small for mobile (${el.size}). Minimum recommended size is 44×44px.`,
      fix: 'Add padding or set min-width/min-height to at least 44px on this element.',
      value: el.size,
    })
  }

  const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 })

  return {
    passed: issues.length === 0,
    issues,
    screenshots: {
      mobile: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
    },
  }
}
