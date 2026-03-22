// ─── Scan job ────────────────────────────────────────────────────────────────

export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface ScanJob {
  id: string
  url: string
  status: ScanStatus
  user_id: string | null
  ip_address: string | null
  created_at: string
  completed_at: string | null
}

// ─── Check types ─────────────────────────────────────────────────────────────

export type CheckType =
  | 'adblock'
  | 'mobile'
  | 'form'
  | 'seo'
  | 'first_impression'

export interface CheckIssue {
  selector?: string       // CSS selector that triggered the issue
  rule?: string           // EasyList rule or relevant rule identifier
  description: string     // Plain-English description
  fix: string             // Specific fix suggestion
  value?: string          // Observed value (e.g., "H1: missing")
}

export interface ScanResult {
  id: string
  job_id: string
  check_type: CheckType
  passed: boolean
  issues: CheckIssue[]
  screenshots: {
    clean?: string         // Base64 or storage URL — clean render
    filtered?: string      // Base64 or storage URL — with adblock/mobile applied
  }
}

// ─── BullMQ job payload ───────────────────────────────────────────────────────

export interface ScanJobPayload {
  jobId: string
  url: string
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface ScanStatusResponse {
  jobId: string
  status: ScanStatus
  url: string
  checks: Array<{
    type: CheckType
    status: 'waiting' | 'running' | 'passed' | 'failed'
  }>
  resultsUrl?: string  // populated once completed
}

// ─── Pricing tiers ───────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro' | 'agency'

export interface UserProfile {
  id: string
  email: string
  plan: Plan
  dodo_customer_id: string | null
  created_at: string
}
