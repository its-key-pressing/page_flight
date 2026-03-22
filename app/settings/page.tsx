import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Account Settings' }

export default function SettingsPage() {
  return (
    <main className="flex min-h-screen flex-col p-6 pt-16">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-sora font-bold text-gray-900">
          Account Settings
        </h1>
        <p className="text-gray-500">
          Profile, subscription management, notifications — built after auth is live.
        </p>
      </div>
    </main>
  )
}
