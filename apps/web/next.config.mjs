/**
 * Purpose: Next.js configuration for the JIMPITAN frontend shell.
 * Caller: next dev/build/start commands.
 * Deps: Next.js App Router runtime.
 * MainFuncs: Enables strict React mode and standalone Docker output.
 * SideEffects: next build writes apps/web/.next.
 */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
