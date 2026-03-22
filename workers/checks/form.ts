import type { Page } from 'playwright'
import type { CheckIssue } from '../../lib/types'

export const TEST_FORM_DATA = {
  email: 'test@example.com',
  name: 'PageFlight Test',
  firstName: 'PageFlight',
  lastName: 'Test',
  phone: '+1 555 000 0000',
  company: 'PageFlight Test Co.',
  message: 'This is an automated test submission from PageFlight.',
}

const SUCCESS_KEYWORDS = [
  'thank you', 'thank-you', 'thankyou',
  'success', 'submitted', 'received',
  'confirmation', 'confirm',
  "we'll be in touch", 'we will be in touch',
  "we'll get back", 'we will get back',
  'message sent', 'form submitted',
]

export interface FormCheckResult {
  passed: boolean
  issues: CheckIssue[]
  screenshots: {
    before?: string
    after?: string
  }
  formsFound: number
}

export async function runFormCheck(page: Page, url: string): Promise<FormCheckResult> {
  const issues: CheckIssue[] = []

  // Restore desktop viewport and reload fresh (mobile check changed the viewport)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

  const formCount = await page.evaluate(() => document.querySelectorAll('form').length)

  if (formCount === 0) {
    return { passed: true, issues: [], screenshots: {}, formsFound: 0 }
  }

  const beforeScreenshot = await page.screenshot({ type: 'jpeg', quality: 80 })
  const beforeBase64 = `data:image/jpeg;base64,${beforeScreenshot.toString('base64')}`

  try {
    // Fill email fields
    const emailInput = page.locator(
      'input[type="email"], input[name*="email" i], input[placeholder*="email" i]'
    ).first()
    if (await emailInput.count() > 0) {
      await emailInput.fill(TEST_FORM_DATA.email)
    }

    // Fill name fields — try first/last separately, then full name
    const firstNameInput = page.locator(
      'input[name*="first" i], input[placeholder*="first name" i]'
    ).first()
    const lastNameInput = page.locator(
      'input[name*="last" i], input[placeholder*="last name" i]'
    ).first()
    const fullNameInput = page.locator(
      'input[name*="name" i]:not([name*="first" i]):not([name*="last" i]), input[placeholder*="full name" i], input[placeholder*="your name" i]'
    ).first()

    if (await firstNameInput.count() > 0) {
      await firstNameInput.fill(TEST_FORM_DATA.firstName)
    }
    if (await lastNameInput.count() > 0) {
      await lastNameInput.fill(TEST_FORM_DATA.lastName)
    }
    if (await fullNameInput.count() > 0) {
      await fullNameInput.fill(TEST_FORM_DATA.name)
    }

    // Fill phone
    const phoneInput = page.locator(
      'input[type="tel"], input[name*="phone" i], input[placeholder*="phone" i]'
    ).first()
    if (await phoneInput.count() > 0) {
      await phoneInput.fill(TEST_FORM_DATA.phone)
    }

    // Fill message/comment textareas
    const textarea = page.locator('textarea').first()
    if (await textarea.count() > 0) {
      await textarea.fill(TEST_FORM_DATA.message)
    }

    // Fill any remaining empty required text inputs
    const requiredTextInputs = page.locator('input[required][type="text"]')
    const requiredCount = await requiredTextInputs.count()
    for (let i = 0; i < Math.min(requiredCount, 3); i++) {
      const val = await requiredTextInputs.nth(i).inputValue()
      if (!val) await requiredTextInputs.nth(i).fill(TEST_FORM_DATA.name)
    }

    const urlBeforeSubmit = page.url()

    // Click submit
    const submitBtn = page.locator(
      'button[type="submit"], input[type="submit"], ' +
      'button:has-text("Submit"), button:has-text("Send"), ' +
      'button:has-text("Get"), button:has-text("Sign up"), ' +
      'button:has-text("Subscribe"), button:has-text("Register")'
    ).first()

    if (await submitBtn.count() === 0) {
      issues.push({
        description: 'No submit button found for the form.',
        fix: 'Add a <button type="submit"> or <input type="submit"> to the form.',
      })
    } else {
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {}),
        submitBtn.click(),
      ])

      // Give inline success messages time to appear
      await page.waitForTimeout(2_000)

      const urlAfterSubmit = page.url()
      const pageText = (await page.evaluate(() => document.body.innerText)).toLowerCase()
      const pageUrl = urlAfterSubmit.toLowerCase()

      const hasSuccessText = SUCCESS_KEYWORDS.some((k) => pageText.includes(k))
      const hasNavigated = urlAfterSubmit !== urlBeforeSubmit
      const hasSuccessUrl = ['/thank', '/success', '/confirm', '/submitted'].some((p) =>
        pageUrl.includes(p)
      )

      if (!hasSuccessText && !hasNavigated && !hasSuccessUrl) {
        issues.push({
          description: 'Form submitted but no success confirmation detected.',
          fix: 'Show a visible thank-you message or redirect to a confirmation page after submission. Without feedback, visitors assume their submission failed.',
        })
      }
    }
  } catch {
    issues.push({
      description: 'Form could not be tested — inputs were not interactable.',
      fix: 'Ensure form inputs are visible and accessible. Check for overlapping elements, disabled states, or JavaScript errors blocking interaction.',
    })
  }

  const afterScreenshot = await page.screenshot({ type: 'jpeg', quality: 80 })
  const afterBase64 = `data:image/jpeg;base64,${afterScreenshot.toString('base64')}`

  return {
    passed: issues.length === 0,
    issues,
    screenshots: { before: beforeBase64, after: afterBase64 },
    formsFound: formCount,
  }
}
