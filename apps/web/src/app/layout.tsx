/**
 * Purpose: Root App Router document layout for the frontend shell.
 * Caller: Next.js App Router runtime.
 * Deps: Global CSS and app-level providers.
 * MainFuncs: Defines metadata, document language, skip link, and provider boundary.
 * SideEffects: Renders global client providers.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'JIMPITAN RT',
    template: '%s | JIMPITAN RT',
  },
  description: 'RT jimpitan, finance, approvals, and public transparency application shell.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Lewati ke konten
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
