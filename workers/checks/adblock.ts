import type { Page } from 'playwright'
import type { CheckIssue } from '../../lib/types'

// Common EasyList cosmetic filter patterns — elements with these in their id/class get hidden
export const EASYLIST_PATTERNS = [
  'ad', 'ads', 'advert', 'advertisement', 'adwrap', 'ad-wrap',
  'ad-container', 'ad-unit', 'ad-block', 'ad-banner', 'ad-slot',
  'banner', 'banner-ad', 'promo', 'promotion', 'promotional',
  'sponsor', 'sponsored', 'sponsorship',
  'tracking', 'tracker',
]

export interface AdblockCheckResult {
  passed: boolean
  issues: CheckIssue[]
  screenshots: {
    clean?: string
    filtered?: string
  }
}

export async function runAdblockCheck(
  page: Page,
  _url: string
): Promise<AdblockCheckResult> {
  const issues: CheckIssue[] = []

  // Take clean screenshot before injecting any filters
  const cleanScreenshot = await page.screenshot({ type: 'jpeg', quality: 80 })
  const cleanBase64 = `data:image/jpeg;base64,${cleanScreenshot.toString('base64')}`

  // Record which elements are currently visible and match ad patterns
  const visibleBefore = await page.evaluate((patterns: string[]) => {
    const results: Array<{ selector: string; matchedPattern: string }> = []
    const all = document.querySelectorAll('[id], [class]')

    for (const el of Array.from(all)) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.top > window.innerHeight) continue // below the fold is OK

      const id = (el.id ?? '').toLowerCase()
      const cls = typeof el.className === 'string' ? el.className.toLowerCase() : ''

      for (const pattern of patterns) {
        const matchesId = id === pattern ||
          id.startsWith(pattern + '-') || id.startsWith(pattern + '_') ||
          id.endsWith('-' + pattern) || id.endsWith('_' + pattern) ||
          id.includes('-' + pattern + '-') || id.includes('_' + pattern + '_')

        const clsParts = cls.split(/\s+/)
        const matchesCls = clsParts.some(c =>
          c === pattern ||
          c.startsWith(pattern + '-') || c.startsWith(pattern + '_') ||
          c.endsWith('-' + pattern) || c.endsWith('_' + pattern) ||
          c.includes('-' + pattern + '-')
        )

        if (matchesId || matchesCls) {
          const tag = el.tagName.toLowerCase()
          const selectorId = el.id ? `#${el.id}` : ''
          const selectorCls = typeof el.className === 'string' && el.className
            ? `.${el.className.trim().split(/\s+/)[0]}`
            : ''
          results.push({ selector: `${tag}${selectorId || selectorCls}`, matchedPattern: pattern })
          break
        }
      }

      if (results.length >= 20) break
    }
    return results
  }, EASYLIST_PATTERNS)

  // Build EasyList-style cosmetic CSS rules
  const cssRules = EASYLIST_PATTERNS.flatMap((p) => [
    `[id="${p}"] { display: none !important; }`,
    `[id^="${p}-"], [id^="${p}_"] { display: none !important; }`,
    `[id$="-${p}"], [id$="_${p}"] { display: none !important; }`,
    `[id*="-${p}-"], [id*="_${p}_"] { display: none !important; }`,
    `[class~="${p}"] { display: none !important; }`,
    `[class*=" ${p}-"], [class*=" ${p}_"] { display: none !important; }`,
    `[class*="-${p} "], [class*="_${p} "] { display: none !important; }`,
    `[class*="-${p}-"], [class*="-${p}_"] { display: none !important; }`,
  ]).join('\n')

  await page.addStyleTag({ content: cssRules })

  // Find elements that are now hidden by adblock filters
  const hiddenAfter = await page.evaluate((patterns: string[]) => {
    const results: Array<{ selector: string; matchedPattern: string }> = []
    const all = document.querySelectorAll('[id], [class]')

    for (const el of Array.from(all)) {
      const style = window.getComputedStyle(el)
      if (style.display !== 'none' && style.visibility !== 'hidden') continue

      const id = (el.id ?? '').toLowerCase()
      const cls = typeof el.className === 'string' ? el.className.toLowerCase() : ''

      for (const pattern of patterns) {
        if (id.includes(pattern) || cls.includes(pattern)) {
          const tag = el.tagName.toLowerCase()
          const selectorId = el.id ? `#${el.id}` : ''
          const selectorCls = typeof el.className === 'string' && el.className
            ? `.${el.className.trim().split(/\s+/)[0]}`
            : ''
          results.push({ selector: `${tag}${selectorId || selectorCls}`, matchedPattern: pattern })
          break
        }
      }

      if (results.length >= 20) break
    }
    return results
  }, EASYLIST_PATTERNS)

  // Report elements that were visible and are now hidden
  const hiddenSet = new Set(hiddenAfter.map((h) => h.selector))
  const blocked = visibleBefore.filter((v) => hiddenSet.has(v.selector))

  for (const el of blocked) {
    issues.push({
      selector: el.selector,
      rule: `##[class*="${el.matchedPattern}"], ##[id*="${el.matchedPattern}"]`,
      description: `Element hidden by EasyList cosmetic filter matching pattern "${el.matchedPattern}".`,
      fix: `Rename the class/ID to remove ad-related keywords. E.g. replace ".${el.matchedPattern}-section" with ".hero-section" or ".cta-block".`,
      value: el.selector,
    })
  }

  // Take filtered screenshot
  const filteredScreenshot = await page.screenshot({ type: 'jpeg', quality: 80 })
  const filteredBase64 = `data:image/jpeg;base64,${filteredScreenshot.toString('base64')}`

  return {
    passed: issues.length === 0,
    issues,
    screenshots: {
      clean: cleanBase64,
      filtered: filteredBase64,
    },
  }
}
