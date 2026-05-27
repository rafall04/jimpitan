/**
 * Purpose: Auth-specific error state for protected dashboard routes.
 * Caller: DashboardShell when current session loading or refresh fails.
 * Deps: Logout mutation and Button component.
 * MainFuncs: Clears invalid cookies before returning users to login without rendering protected route content.
 * SideEffects: Calls same-origin logout route when requested.
 */
'use client';

import { Button } from '@/components/ui/button';
import { useLogoutMutation } from './use-session';

export function AuthErrorPanel() {
  const logoutMutation = useLogoutMutation();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm" role="alert">
        <h1 className="text-xl font-semibold">Session expired</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in again to continue.</p>
        <Button className="mt-5" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
          {logoutMutation.isPending ? 'Clearing session' : 'Go to login'}
        </Button>
      </section>
    </main>
  );
}
