import { createClient } from '@/lib/supabase/server'
import SidebarNav from './SidebarNav'

export default async function Sidebar() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-60 bg-white border-r border-gray-100 flex flex-col z-40">

      {/* New scan CTA */}
      <div className="px-3 py-4">
        <a
          href="/"
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New scan
        </a>
      </div>

      {/* Nav items */}
      <SidebarNav />

      {/* User section */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          {/* Avatar */}
          <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-indigo-700">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">
              {user?.email ?? 'Unknown'}
            </p>
            <p className="text-xs text-gray-400">Free plan</p>
          </div>
        </div>

        <form action="/auth/signout" method="post" className="mt-1">
          <button
            type="submit"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
