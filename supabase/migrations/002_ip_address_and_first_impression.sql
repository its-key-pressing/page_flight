-- Session 5: ip_address for rate limiting; first_impression check type for 5th scanner check

ALTER TABLE public.scan_jobs ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE public.scan_results DROP CONSTRAINT IF EXISTS scan_results_check_type_check;

ALTER TABLE public.scan_results ADD CONSTRAINT scan_results_check_type_check
  CHECK (check_type IN ('adblock', 'mobile', 'form', 'seo', 'first_impression'));
