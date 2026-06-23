/**
 * Purpose: Root App Router document layout for the frontend shell.
 * Caller: Next.js App Router runtime.
 * Deps: Global CSS and app-level providers.
 * MainFuncs: Defines metadata, document language, skip link, and provider boundary.
 * SideEffects: Renders global client providers.
 */
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { AppProviders } from './providers';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'RTku — Komunitas & transparansi RT',
    template: '%s | RTku',
  },
  description: 'RTku — kelola warga, kas RT yang transparan, kegiatan, dan pengumuman dalam satu tempat.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id" className={jakarta.variable} suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Lewati ke konten
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
