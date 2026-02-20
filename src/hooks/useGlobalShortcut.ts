// ---------------------------------------------------------------------------
// Global System-Wide Hotkeys
// ---------------------------------------------------------------------------
// Registers shortcuts that work even when the app is not focused:
//   Ctrl+Shift+Space — show/focus the app
//   Ctrl+Shift+A     — quick-approve oldest pending approval
//   Ctrl+Shift+D     — quick-deny oldest pending approval

import { useEffect } from 'react';
import { useApprovalsStore } from '@/stores/approvals';

export function useGlobalShortcut(): void {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const setup = async () => {
      try {
        const { register, unregisterAll } = await import('@tauri-apps/plugin-global-shortcut');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');

        // Show/focus app
        await register('Ctrl+Shift+Space', async () => {
          const win = getCurrentWindow();
          await win.show();
          await win.setFocus();
        });

        // Quick-approve oldest pending
        await register('Ctrl+Shift+A', async () => {
          const { pendingRequests, resolveApproval } = useApprovalsStore.getState();
          const oldest = pendingRequests[0];
          if (oldest?.id) {
            await resolveApproval(oldest.id, 'approve');
          }
        });

        // Quick-deny oldest pending
        await register('Ctrl+Shift+D', async () => {
          const { pendingRequests, resolveApproval } = useApprovalsStore.getState();
          const oldest = pendingRequests[0];
          if (oldest?.id) {
            await resolveApproval(oldest.id, 'deny');
          }
        });

        cleanup = () => {
          unregisterAll().catch(() => {});
        };
      } catch {
        // Not in Tauri context or plugin not available
      }
    };

    setup();

    return () => {
      cleanup?.();
    };
  }, []);
}
