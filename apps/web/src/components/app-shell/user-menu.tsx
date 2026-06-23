/**
 * Purpose: Topbar user account menu (identity + logout).
 * Caller: Topbar.
 * Deps: dropdown-menu primitives, Avatar, Button, tenant context, logout mutation.
 * MainFuncs: Shows the signed-in user + active RT and signs out.
 * SideEffects: Triggers the logout mutation.
 */
'use client';

import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLogoutMutation } from '@/features/auth/use-session';
import { useTenantContext } from '@/features/tenants/tenant-provider';

export function UserMenu() {
  const { session, activeTenant } = useTenantContext();
  const logoutMutation = useLogoutMutation();
  const name = session?.user.name ?? 'Pengguna';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="h-10 gap-2 px-1.5" aria-label="Menu akun">
          <Avatar name={name} className="h-8 w-8" />
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{activeTenant?.rtName ?? 'RT belum dipilih'}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          disabled={logoutMutation.isPending}
          onSelect={(event) => {
            event.preventDefault();
            logoutMutation.mutate();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          {logoutMutation.isPending ? 'Keluar…' : 'Keluar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
