// ---------------------------------------------------------------------------
// Global Keyboard Shortcuts
// ---------------------------------------------------------------------------
// Registers app-wide keyboard shortcuts for view navigation and actions.
// Cmd+1 through Cmd+9 switch views, Cmd+N creates a new session, etc.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboard';
import { useChatStore } from '@/stores/chat';

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
  const { setActiveSession } = useChatStore();

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
          // Clear the active session so Chat view starts fresh
          // setActiveSession('') signals "no session selected" — Chat will
          // auto-select from the session list, effectively resetting to a
          // clean slate without destroying chat history.
          setActiveSession('');
          navigate('/');
        },
      },
    ];

    return [...viewShortcuts, ...actionShortcuts];
  }, [navigate, setActiveSession]);

  useKeyboardShortcuts(shortcuts);

  // This component renders nothing — it only registers shortcuts
  return null;
}
