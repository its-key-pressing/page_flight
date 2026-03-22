import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <a href={user ? '/dashboard' : '/'} className="text-lg font-sora font-bold text-[#4F46E5]">
          PageFlight
        </a>

        <nav className="flex items-center gap-4">
          {user ? (
            // Logged-in: sidebar handles navigation — just show a subtle plan badge
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
              Free plan
            </span>
          ) : (
            <>
              <a
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Log in
              </a>
              <a
                href="/signup"
                className="btn-primary text-sm py-1.5 px-4"
              >
                Sign up free
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
