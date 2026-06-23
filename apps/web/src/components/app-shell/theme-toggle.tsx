/**
 * Purpose: Light/dark theme toggle button.
 * Caller: Topbar.
 * Deps: next-themes, lucide Sun/Moon, Button.
 * MainFuncs: Toggles between light and dark, guarding against hydration mismatch.
 * SideEffects: Persists the theme choice via next-themes.
 */
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button type="button" variant="ghost" size="icon" aria-label={isDark ? 'Mode terang' : 'Mode gelap'} onClick={() => setTheme(isDark ? 'light' : 'dark')}>
      {isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </Button>
  );
}
