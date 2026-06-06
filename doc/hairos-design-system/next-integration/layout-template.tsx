/**
 * HairOS Design System — Root Layout Template
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop this into app/layout.tsx of your Next.js project.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Metadata, Viewport } from 'next';
import { fontVariables } from '@/design-system/next-integration/fonts';
import '@/design-system/css/globals.css';

export const metadata: Metadata = {
  title: {
    default:  'HairOS',
    template: '%s — HairOS',
  },
  description: 'Precision hair diagnostics. Your scalp, understood.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://hairos.app'),
  openGraph: {
    type:   'website',
    locale: 'en_GB',
    siteName: 'HairOS',
  },
  robots: {
    index:   false,   // clinical app — no indexing
    follow:  false,
  },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,            // prevent zoom on clinical forms
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#0A0E1A' },
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
  ],
  colorScheme: 'dark light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // HairOS ships dark by default
      className={`dark ${fontVariables}`}
      suppressHydrationWarning
    >
      <head>
        {/* DNS prefetch for any external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      </head>
      <body
        className={[
          // Base semantic tokens
          'bg-[var(--bg-base)] text-[var(--tx-primary)]',
          // Font stack
          'font-body antialiased',
          // Prevent FOUC on theme
          'transition-colors duration-normal',
          // iOS safe area support
          'min-h-dvh',
        ].join(' ')}
      >
        {/* Theme provider would wrap here if using next-themes */}
        {children}
      </body>
    </html>
  );
}
