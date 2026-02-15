// ---------------------------------------------------------------------------
// Global Keyboard Shortcuts Hook
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { usePaletteStore } from '@/stores/palette';

interface KeyboardCallbacks {
  onTogglePalette?: () => void;
}

const VIEW_SHORTCUTS: Record<string, string> = {
  '1': '/',
  '2': '/sessions',
  '3': '/channels',
  '4': '/agents',
  '5': '/config',
  '6': '/approvals',
  '7': '/cron',
  '8': '/logs',
  '9': '/more',
};

export function useKeyboard(
  navigate: NavigateFunction,
  callbacks?: KeyboardCallbacks
): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+K — toggle command palette
      if (meta && e.key === 'k') {
        e.preventDefault();
        if (callbacks?.onTogglePalette) {
          callbacks.onTogglePalette();
        } else {
          usePaletteStore.getState().toggle();
        }
        return;
      }

      // Cmd+N — new chat
      if (meta && e.key === 'n') {
        e.preventDefault();
        navigate('/');
        return;
      }

      // Cmd+, — config
      if (meta && e.key === ',') {
        e.preventDefault();
        navigate('/config');
        return;
      }

      // Cmd+1 through Cmd+9 — view switching
      if (meta && e.key in VIEW_SHORTCUTS) {
        const path = VIEW_SHORTCUTS[e.key];
        if (path) {
          e.preventDefault();
          navigate(path);
        }
        return;
      }

      // Escape — close palette
      if (e.key === 'Escape') {
        const { isOpen, close } = usePaletteStore.getState();
        if (isOpen) {
          e.preventDefault();
          close();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, callbacks]);
}
