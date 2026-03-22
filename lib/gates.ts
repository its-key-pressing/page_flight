import type { Plan } from './types'

/** Clean PDF export (no watermark) — Pro and Agency */
export function canExportCleanPDF(plan: Plan): boolean {
  return plan === 'pro' || plan === 'agency'
}

/** Bulk scan (multiple URLs in one job) — Pro and Agency */
export function canBulkScan(plan: Plan): boolean {
  return plan === 'pro' || plan === 'agency'
}

/** Max URLs per bulk scan */
export function bulkScanLimit(plan: Plan): number {
  if (plan === 'agency') return 50
  if (plan === 'pro') return 10
  return 1
}

/** Weekly monitoring + regression alerts — Pro and Agency */
export function canMonitor(plan: Plan): boolean {
  return plan === 'pro' || plan === 'agency'
}

/** White-label PDF (remove PageFlight branding) — Agency only */
export function canWhiteLabel(plan: Plan): boolean {
  return plan === 'agency'
}

/** Client workspaces — Agency only */
export function canUseClientWorkspaces(plan: Plan): boolean {
  return plan === 'agency'
}

/** Team seats — Agency only */
export function canAddTeamSeats(plan: Plan): boolean {
  return plan === 'agency'
}

/** CSV export — Agency only */
export function canExportCSV(plan: Plan): boolean {
  return plan === 'agency'
}

/** Shareable public report links — all paid plans (distribution mechanic) */
export function canShareReports(plan: Plan): boolean {
  return true // all tiers — public /results/[id] is already accessible
}

/** Monthly scan limit for free users */
export const FREE_MONTHLY_SCAN_LIMIT = 5

/** Anonymous scan limit (enforced both client-side and server-side) */
export const ANON_SCAN_LIMIT = 3
