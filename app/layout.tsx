import type { Metadata } from 'next'
import { Sora, Inter } from 'next/font/google'
import Navbar from '@/components/Navbar'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'PageFlight — Landing Page Audit Tool',
    template: '%s | PageFlight',
  },
  description:
    'Scan your landing page the way real visitors see it — adblock enabled, mobile viewports, real conditions. Catch invisible bugs before you spend on ads.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pageflight.io'
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-gray-50 font-inter antialiased">
        <Navbar />
        <div className="pt-14">
          {children}
        </div>
      </body>
    </html>
  )
}
