// ---------------------------------------------------------------------------
// Command Palette (Cmd+K)
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaletteStore } from '@/stores/palette';
import { useConnectionStore } from '@/stores/connection';
import { cn } from '@/lib/utils';

// ---- Types ----------------------------------------------------------------

interface PaletteItem {
  id: string;
  icon: string;
  label: string;
  category: 'Navigation' | 'Actions';
  shortcut?: string;
  action: () => void;
}

// ---- Navigation items (static definitions) --------------------------------

const NAV_ITEMS: { icon: string; label: string; path: string; shortcut?: string }[] = [
  { icon: '💬', label: 'Chat', path: '/', shortcut: '⌘1' },
  { icon: '📋', label: 'Sessions', path: '/sessions', shortcut: '⌘2' },
  { icon: '📡', label: 'Channels', path: '/channels', shortcut: '⌘3' },
  { icon: '🤖', label: 'Agents', path: '/agents', shortcut: '⌘4' },
  { icon: '⚙️', label: 'Config', path: '/config', shortcut: '⌘5' },
  { icon: '✓', label: 'Approvals', path: '/approvals', shortcut: '⌘6' },
  { icon: '⏰', label: 'Cron', path: '/cron', shortcut: '⌘7' },
  { icon: '🔌', label: 'Skills', path: '/skills' },
  { icon: '📱', label: 'Devices', path: '/devices' },
  { icon: '📜', label: 'Logs', path: '/logs', shortcut: '⌘8' },
  { icon: '🧠', label: 'Models', path: '/models' },
  { icon: '📊', label: 'Usage', path: '/usage' },
];

// ---- Component ------------------------------------------------------------

export function CommandPalette() {
  const { isOpen, close } = usePaletteStore();
  const disconnect = useConnectionStore((s) => s.disconnect);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build items list with live navigate/disconnect references
  const allItems: PaletteItem[] = useMemo(() => {
    const navItems: PaletteItem[] = NAV_ITEMS.map((item) => ({
      id: `nav-${item.path}`,
      icon: item.icon,
      label: item.label,
      category: 'Navigation',
      shortcut: item.shortcut,
      action: () => {
        navigate(item.path);
        close();
      },
    }));

    const actionItems: PaletteItem[] = [
      {
        id: 'action-new-session',
        icon: '✨',
        label: 'New Session',
        category: 'Actions',
        shortcut: '⌘N',
        action: () => {
          navigate('/');
          close();
        },
      },
      {
        id: 'action-disconnect',
        icon: '🔌',
        label: 'Disconnect',
        category: 'Actions',
        action: () => {
          disconnect();
          close();
        },
      },
      {
        id: 'action-clear-logs',
        icon: '🗑️',
        label: 'Clear Logs',
        category: 'Actions',
        action: () => {
          // Placeholder — logs store can implement this later
          close();
        },
      },
    ];

    return [...navItems, ...actionItems];
  }, [navigate, close, disconnect]);

  // Filter items by query (case-insensitive substring match)
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const lower = query.toLowerCase();
    return allItems.filter((item) => item.label.toLowerCase().includes(lower));
  }, [allItems, query]);

  // Group filtered items by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: PaletteItem[] }[] = [];
    const seen = new Set<string>();
    for (const item of filtered) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        groups.push({ category: item.category, items: [] });
      }
      groups.find((g) => g.category === item.category)!.items.push(item);
    }
    return groups;
  }, [filtered]);

  // Build a flat list for keyboard navigation indexing
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Reset state when palette opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input on next tick (after render)
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Clamp selectedIndex when filtered results change
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Keyboard navigation inside the palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) item.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    },
    [flatItems, selectedIndex, close]
  );

  // Click on backdrop closes palette
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/80 pt-[15vh] backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="border-b border-zinc-700 p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-0 focus:ring-2 focus:ring-amber-500/50 rounded px-2 py-1.5"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {flatItems.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">
              No results found
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              {/* Category header */}
              <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                {group.category}
              </div>

              {/* Items */}
              {group.items.map((item) => {
                const index = runningIndex++;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={item.id}
                    data-selected={isSelected}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    )}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.shortcut && (
                      <span className="shrink-0 text-xs text-zinc-500">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
          <span>
            <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-400">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-400">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-400">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
