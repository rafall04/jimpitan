/**
 * Purpose: Settings dashboard route.
 * Caller: App Router route at /dashboard/settings.
 * Deps: SettingsPage feature component.
 * MainFuncs: Mounts the tenant-aware settings UI (RT profile + kas visibility).
 * SideEffects: None.
 */
import { SettingsPage } from '@/features/settings/pages/settings-page';

export default function Page() {
  return <SettingsPage />;
}
