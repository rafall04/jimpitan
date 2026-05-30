/**
 * Purpose: Client TanStack Query hooks for auth session, refresh, and logout flows.
 * Caller: DashboardShell, LoginForm, Topbar, and future auth-aware UI.
 * Deps: TanStack Query, Next router, sonner, auth client, and query keys.
 * MainFuncs: Loads current session/profile/tenant context, logs in through the configured backend, refreshes, and logs out without storing tokens.
 * SideEffects: Performs backend login and same-origin session requests, updates query cache, navigates, and shows toasts.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query/query-keys';
import type { LoginFormValues } from './login.schema';
import { fetchCurrentSession, loginWithPassword, logoutCurrentSession, refreshCurrentSession } from './auth-client';
import { sanitizeRedirectPath } from './redirects';

export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.auth.session(),
    queryFn: fetchCurrentSession,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLoginMutation(nextPath: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: LoginFormValues) => loginWithPassword(values),
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.auth.session(), data);
      toast.success('Login successful');
      router.replace(sanitizeRedirectPath(nextPath));
      router.refresh();
    },
  });
}

export function useRefreshSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshCurrentSession,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.session(), data);
    },
  });
}

export function useLogoutMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutCurrentSession,
    onSettled: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.auth.session() });
      queryClient.removeQueries({ queryKey: queryKeys.auth.session() });
      toast.success('Logged out');
      router.replace('/login');
      router.refresh();
    },
  });
}
