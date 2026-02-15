// ---------------------------------------------------------------------------
// Command Palette (Cmd+K)
// ---------------------------------------------------------------------------
// A cmdk-powered command palette for quick navigation, actions, and search.
// Styled to match the dark amber Fireplace design system.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useKeyboardShortcut, formatShortcut } from '@/hooks/useKeyboard';
import { useConnectionStore } from '@/stores/connection';

// ---- Navigation Items -----------------------------------------------------

interface PaletteItem {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  group: string;
  shortcut?: string;
  keywords?: string[];
}

interface NavRoute {
  label: string;
  path: string;
  icon: string;
  shortcut?: string;
  keywords: string[];
}

const NAV_ROUTES: NavRoute[] = [
  {
    label: 'Chat',
    path: '/',
    icon: '>',
    shortcut: 'cmd+1',
    keywords: ['message', 'talk', 'conversation'],
  },
  {
    label: 'Sessions',
    path: '/sessions',
    icon: '=',
    shortcut: 'cmd+2',
    keywords: ['session', 'history'],
  },
  {
    label: 'Channels',
    path: '/channels',
    icon: '#',
    shortcut: 'cmd+3',
    keywords: ['channel', 'slack', 'discord'],
  },
  { label: 'Agents', path: '/agents', icon: '@', shortcut: 'cmd+4', keywords: ['agent', 'bot'] },
  {
    label: 'Config',
    path: '/config',
    icon: '*',
    shortcut: 'cmd+5',
    keywords: ['settings', 'configuration'],
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: '?',
    shortcut: 'cmd+6',
    keywords: ['approve', 'exec', 'permission'],
  },
  {
    label: 'Cron',
    path: '/cron',
    icon: '~',
    shortcut: 'cmd+7',
    keywords: ['schedule', 'timer', 'cron'],
  },
  {
    label: 'Skills',
    path: '/skills',
    icon: '+',
    shortcut: 'cmd+8',
    keywords: ['skill', 'plugin', 'tool'],
  },
  {
    label: 'Devices',
    path: '/devices',
    icon: '.',
    shortcut: 'cmd+9',
    keywords: ['device', 'phone'],
  },
  { label: 'Logs', path: '/logs', icon: '|', keywords: ['log', 'debug', 'output'] },
  { label: 'Models', path: '/models', icon: '%', keywords: ['model', 'llm', 'claude'] },
  { label: 'Usage', path: '/usage', icon: '$', keywords: ['usage', 'tokens', 'cost'] },
];

// ---- Component ------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { status, disconnect, connect } = useConnectionStore();

  // Cmd+K to toggle
  useKeyboardShortcut(
    'cmd+k',
    useCallback(() => setOpen((prev) => !prev), [])
  );

  // Escape to close (only when open)
  useKeyboardShortcut(
    'escape',
    useCallback(() => setOpen(false), []),
    open
  );

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Build palette items
  const items = useMemo((): PaletteItem[] => {
    const navItems: PaletteItem[] = NAV_ROUTES.map((route) => ({
      id: `nav-${route.path}`,
      label: route.label,
      icon: route.icon,
      action: () => navigate(route.path),
      group: 'Navigation',
      shortcut: route.shortcut,
      keywords: route.keywords ? [...route.keywords] : undefined,
    }));

    const actionItems: PaletteItem[] = [
      {
        id: 'action-new-session',
        label: 'New Session',
        icon: '+',
        action: () => {
          navigate('/');
          // The Chat view handles new session creation
        },
        group: 'Actions',
        shortcut: 'cmd+n',
        keywords: ['new', 'create', 'session'],
      },
      {
        id: 'action-reconnect',
        label: status === 'connected' ? 'Disconnect from Gateway' : 'Connect to Gateway',
        icon: status === 'connected' ? 'x' : '>',
        action: () => {
          if (status === 'connected') {
            disconnect();
          } else {
            connect();
          }
        },
        group: 'Actions',
        keywords: ['connect', 'disconnect', 'gateway', 'reconnect'],
      },
    ];

    return [...navItems, ...actionItems];
  }, [navigate, status, disconnect, connect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/50">
        <Command
          filter={(value, search) => {
            // Custom fuzzy-ish filter: check if all search chars appear in order
            const item = items.find((i) => i.id === value);
            if (!item) return 0;

            const haystack = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
            const needle = search.toLowerCase();

            if (haystack.includes(needle)) return 1;

            // Check if all chars of search appear in order in haystack
            let hIdx = 0;
            for (const char of needle) {
              const found = haystack.indexOf(char, hIdx);
              if (found === -1) return 0;
              hIdx = found + 1;
            }
            return 0.5;
          }}
        >
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Navigation">
              {items
                .filter((item) => item.group === 'Navigation')
                .map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      item.action();
                      setOpen(false);
                    }}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 font-mono text-xs text-zinc-400">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <CommandShortcut>{formatShortcut(item.shortcut)}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              {items
                .filter((item) => item.group === 'Actions')
                .map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      item.action();
                      setOpen(false);
                    }}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 font-mono text-xs text-zinc-400">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <CommandShortcut>{formatShortcut(item.shortcut)}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>

          {/* Footer with hint */}
          <div className="flex items-center justify-between border-t border-zinc-700 px-3 py-2">
            <span className="text-xs text-zinc-500">Navigate with arrow keys, Enter to select</span>
            <span className="text-xs text-zinc-600">{formatShortcut('cmd+k')} to toggle</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
