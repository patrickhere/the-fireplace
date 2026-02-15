// ---------------------------------------------------------------------------
// Keyboard Shortcut Manager
// ---------------------------------------------------------------------------
// Registers global keyboard shortcuts and provides a way to bind/unbind them.
// All shortcuts are Cmd-based (macOS).

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  /** Unique key for this shortcut */
  id: string;
  /** Human-readable description */
  label: string;
  /** Key combination, e.g. "cmd+k", "cmd+1", "escape" */
  keys: string;
  /** Handler function */
  handler: () => void;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
}

/** Parse a key string like "cmd+shift+k" into its components. */
function parseKeys(keys: string): {
  meta: boolean;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  key: string;
} {
  const parts = keys.toLowerCase().split('+');
  return {
    meta: parts.includes('cmd') || parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    ctrl: parts.includes('ctrl'),
    key:
      parts.filter((p) => !['cmd', 'meta', 'shift', 'alt', 'option', 'ctrl'].includes(p))[0] ?? '',
  };
}

/** Check if a keyboard event matches a shortcut definition. */
function matchesShortcut(event: KeyboardEvent, keys: string): boolean {
  const parsed = parseKeys(keys);
  const eventKey = event.key.toLowerCase();

  // Handle special key names
  const keyMatch =
    parsed.key === 'enter'
      ? eventKey === 'enter'
      : parsed.key === 'escape'
        ? eventKey === 'escape'
        : parsed.key === 'backspace'
          ? eventKey === 'backspace'
          : parsed.key === ','
            ? eventKey === ','
            : eventKey === parsed.key;

  return (
    keyMatch &&
    event.metaKey === parsed.meta &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.ctrlKey === parsed.ctrl
  );
}

/**
 * Hook that registers a single keyboard shortcut.
 *
 * @example
 * useKeyboardShortcut('cmd+k', () => setOpen(true));
 */
export function useKeyboardShortcut(keys: string, handler: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: KeyboardEvent) => {
      if (matchesShortcut(event, keys)) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [keys, handler, enabled]);
}

/**
 * Hook that registers multiple keyboard shortcuts at once.
 *
 * @example
 * useKeyboardShortcuts([
 *   { id: 'palette', label: 'Command Palette', keys: 'cmd+k', handler: openPalette },
 *   { id: 'new', label: 'New Session', keys: 'cmd+n', handler: newSession },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        if (matchesShortcut(event, shortcut.keys)) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/** Format a key string for display (e.g. "cmd+k" -> "⌘K"). */
export function formatShortcut(keys: string): string {
  return keys
    .split('+')
    .map((part) => {
      switch (part.toLowerCase()) {
        case 'cmd':
        case 'meta':
          return '\u2318';
        case 'shift':
          return '\u21E7';
        case 'alt':
        case 'option':
          return '\u2325';
        case 'ctrl':
          return '\u2303';
        case 'enter':
          return '\u21A9';
        case 'escape':
          return 'Esc';
        case 'backspace':
          return '\u232B';
        default:
          return part.toUpperCase();
      }
    })
    .join('');
}
