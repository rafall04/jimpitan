/**
 * Purpose: Settings page placeholder route.
 * Caller: App Router route at /dashboard/settings.
 * Deps: PlaceholderPage component.
 * MainFuncs: Reserves tenant and user settings UI without implementing mutations.
 * SideEffects: None.
 */
import { PlaceholderPage } from '@/components/app-shell/placeholder-page';

export default function SettingsPage() {
  return <PlaceholderPage title="Settings" description="RT configuration, roles, and account settings will be implemented later." />;
}
