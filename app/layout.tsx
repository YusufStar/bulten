import type { Metadata, Viewport } from 'next'
import { Archivo, Newsreader } from 'next/font/google'
import './globals.css'

const serif = Newsreader({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--f-serif',
})
const sans = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--f-sans' })

export const metadata: Metadata = {
  title: 'Freewill Gündem',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#c8102e' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
