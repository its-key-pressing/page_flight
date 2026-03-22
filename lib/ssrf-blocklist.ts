/**
 * SSRF (Server-Side Request Forgery) protection.
 *
 * Prevents attackers from submitting internal network addresses to our scanner,
 * which would cause our Playwright worker to probe internal infrastructure.
 */

const MAX_URL_LENGTH = 2048

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  // IPv6 loopback with brackets
  '[::1]',
  // AWS metadata
  '169.254.169.254',
  // GCP metadata
  'metadata.google.internal',
])

// Private IPv4 CIDR ranges — checked via prefix matching
const PRIVATE_IPV4_PREFIXES = [
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
]

// IPv6 private / link-local / special prefixes (lowercase, no brackets)
const PRIVATE_IPV6_PREFIXES = [
  'fc',   // fc00::/7 — unique local
  'fd',   // fd00::/8 — unique local
  'fe80', // fe80::/10 — link-local
  'fe90',
  'fea0',
  'feb0',
]

// IPv4-mapped IPv6 prefixes that tunnel private IPv4 ranges
const IPV4_MAPPED_PREFIXES = [
  '::ffff:127.',       // loopback
  '::ffff:169.254.',   // link-local / AWS metadata
  '::ffff:10.',        // private
  '::ffff:192.168.',   // private
  '::ffff:172.16.',    // private (16–31 handled below)
]

function isPrivateMappedIPv6(host: string): boolean {
  // Check ::ffff:172.16-31.x.x
  const mappedPrivate172 = /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./i
  if (mappedPrivate172.test(host)) return true

  return IPV4_MAPPED_PREFIXES.some(p => host.startsWith(p))
}

/**
 * Returns true if the URL is safe to scan (not an internal address).
 */
export function isSafeUrl(rawUrl: string): boolean {
  if (rawUrl.length > MAX_URL_LENGTH) return false

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  // Only allow https (not http, file, ftp, etc.)
  if (parsed.protocol !== 'https:') return false

  // Strip brackets from IPv6 hostnames: [::1] → ::1
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOSTNAMES.has(`[${hostname}]`)) {
    return false
  }

  // IPv4 private ranges
  for (const prefix of PRIVATE_IPV4_PREFIXES) {
    if (hostname.startsWith(prefix)) return false
  }

  // IPv6 private / link-local ranges
  for (const prefix of PRIVATE_IPV6_PREFIXES) {
    if (hostname.startsWith(prefix)) return false
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x tunnelling private IPv4)
  if (isPrivateMappedIPv6(hostname)) return false

  return true
}

/**
 * Validates and normalises a user-submitted URL.
 * Returns the normalised HTTPS URL string, or null if invalid/unsafe.
 */
export function validateScanUrl(input: string): string | null {
  if (!input || input.length > MAX_URL_LENGTH) return null

  const trimmed = input.trim()

  // Prepend https:// if the user omitted the protocol
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, 'https://')  // force HTTPS
    : `https://${trimmed}`

  if (!isSafeUrl(withProtocol)) return null

  try {
    const url = new URL(withProtocol)
    return url.toString()
  } catch {
    return null
  }
}
