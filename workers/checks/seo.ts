import type { Page } from 'playwright'
import type { CheckIssue } from '../../lib/types'

const SEO_LIMITS = {
  titleMin: 10,
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 160,
}

export interface SeoCheckResult {
  passed: boolean
  issues: CheckIssue[]
  screenshots: Record<string, never>
  data: {
    h1Count: number
    titleLength: number | null
    descriptionLength: number | null
  }
}

export async function runSeoCheck(page: Page, url: string): Promise<SeoCheckResult> {
  const issues: CheckIssue[] = []

  // Reload in case a previous check navigated away
  if (page.url() !== url) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  }

  const data = await page.evaluate(() => {
    const h1s = document.querySelectorAll('h1')
    const title = document.title
    const metaDescEl = document.querySelector('meta[name="description"]')
    const metaDesc = metaDescEl ? metaDescEl.getAttribute('content') : null

    return {
      h1Count: h1s.length,
      h1Texts: Array.from(h1s).map((h) => h.textContent?.trim() ?? ''),
      titleLength: title.length,
      titleText: title,
      descriptionLength: metaDesc !== null ? metaDesc.length : null,
    }
  })

  // H1 checks
  if (data.h1Count === 0) {
    issues.push({
      description: 'No H1 heading found on this page.',
      fix: 'Add a single H1 tag that clearly describes the page\'s main offer or topic.',
    })
  } else if (data.h1Count > 1) {
    issues.push({
      description: `${data.h1Count} H1 headings found — a page should have exactly one.`,
      fix: 'Keep only one H1 per page. Convert additional H1s to H2 or H3.',
      value: `H1 count: ${data.h1Count}`,
    })
  } else if (data.h1Texts[0] === '') {
    issues.push({
      description: 'H1 tag is present but empty.',
      fix: 'Add meaningful text inside the H1 — it should describe your page\'s main topic.',
    })
  }

  // Title checks
  if (data.titleLength === 0) {
    issues.push({
      description: 'Page has no title tag.',
      fix: 'Add a <title> tag with 10–60 characters describing the page.',
    })
  } else if (data.titleLength < SEO_LIMITS.titleMin) {
    issues.push({
      description: `Title is too short (${data.titleLength} chars). Minimum recommended: ${SEO_LIMITS.titleMin}.`,
      fix: 'Expand the title to be more descriptive (10–60 characters recommended).',
      value: data.titleText,
    })
  } else if (data.titleLength > SEO_LIMITS.titleMax) {
    issues.push({
      description: `Title is too long (${data.titleLength} chars). Maximum recommended: ${SEO_LIMITS.titleMax}.`,
      fix: 'Shorten the title to 60 characters or fewer to prevent truncation in search results.',
      value: data.titleText,
    })
  }

  // Meta description checks
  if (data.descriptionLength === null) {
    issues.push({
      description: 'No meta description found.',
      fix: 'Add <meta name="description" content="..."> with 50–160 characters summarising the page.',
    })
  } else if (data.descriptionLength < SEO_LIMITS.descriptionMin) {
    issues.push({
      description: `Meta description too short (${data.descriptionLength} chars). Minimum recommended: ${SEO_LIMITS.descriptionMin}.`,
      fix: 'Expand your meta description to 50–160 characters for better search snippet quality.',
    })
  } else if (data.descriptionLength > SEO_LIMITS.descriptionMax) {
    issues.push({
      description: `Meta description too long (${data.descriptionLength} chars). Maximum recommended: ${SEO_LIMITS.descriptionMax}.`,
      fix: 'Shorten your meta description to 160 characters or fewer to prevent truncation.',
    })
  }

  return {
    passed: issues.length === 0,
    issues,
    screenshots: {},
    data: {
      h1Count: data.h1Count,
      titleLength: data.titleLength || null,
      descriptionLength: data.descriptionLength,
    },
  }
}

export { SEO_LIMITS }
