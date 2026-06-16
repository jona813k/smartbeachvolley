import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SmartBeachVolley',
  description: 'AI-powered post-game beach volleyball analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0F172A] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  )
}
