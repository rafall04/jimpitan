/**
 * Purpose: Notification UI foundation for unread-count access.
 * Caller: Dashboard topbar and future notification menus.
 * Deps: lucide-react and Button component.
 * MainFuncs: Renders an accessible notification trigger without fetching business data.
 * SideEffects: None.
 */
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationBell({ unreadCount = 0 }: { unreadCount?: number }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="relative" aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}>
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className="absolute ml-5 mt-[-1.5rem] min-w-5 rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Button>
  );
}
