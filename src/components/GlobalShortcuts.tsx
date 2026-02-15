// ---------------------------------------------------------------------------
// Global Keyboard Shortcuts
// ---------------------------------------------------------------------------
// Registers app-wide keyboard shortcuts for view navigation and actions.
// Cmd+1 through Cmd+9 switch views, Cmd+N creates a new session, etc.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import type { KeyboardShortcut } from '@/hooks/useKeyboard';

const VIEW_ROUTES = [
  { key: '1', path: '/', label: 'Chat' },
  { key: '2', path: '/sessions', label: 'Sessions' },
  { key: '3', path: '/channels', label: 'Channels' },
  { key: '4', path: '/agents', label: 'Agents' },
  { key: '5', path: '/config', label: 'Config' },
  { key: '6', path: '/approvals', label: 'Approvals' },
  { key: '7', path: '/cron', label: 'Cron' },
  { key: '8', path: '/skills', label: 'Skills' },
  { key: '9', path: '/devices', label: 'Devices' },
] as const;

export function GlobalShortcuts() {
  const navigate = useNavigate();

  const shortcuts = useMemo((): KeyboardShortcut[] => {
    const viewShortcuts: KeyboardShortcut[] = VIEW_ROUTES.map((route) => ({
      id: `nav-${route.key}`,
      label: `Go to ${route.label}`,
      keys: `cmd+${route.key}`,
      handler: () => navigate(route.path),
    }));

    const actionShortcuts: KeyboardShortcut[] = [
      {
        id: 'new-session',
        label: 'New Session',
        keys: 'cmd+n',
        handler: () => {
          // Navigate to Chat view where new sessions are created
          navigate('/');
        },
      },
    ];

    return [...viewShortcuts, ...actionShortcuts];
  }, [navigate]);

  useKeyboardShortcuts(shortcuts);

  // This component renders nothing — it only registers shortcuts
  return null;
}
