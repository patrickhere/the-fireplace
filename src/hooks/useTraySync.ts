// ---------------------------------------------------------------------------
// Tray Sync Hook — keeps macOS tray menu in sync with app state
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import { useConnectionStore } from '@/stores/connection';
import { useApprovalsStore } from '@/stores/approvals';
import { useNavigate } from 'react-router-dom';

function statusLabel(status: string): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'disconnected':
    default:
      return 'Disconnected';
  }
}

export function useTraySync(): void {
  const connectionStatus = useConnectionStore((s) => s.status);
  const pendingCount = useApprovalsStore((s) => s.pendingRequests.length);
  const navigate = useNavigate();

  // Expose navigation function for tray menu events
  useEffect(() => {
    const nav = (route: string) => {
      navigate(route);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__trayNav = nav;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__trayNav;
    };
  }, [navigate]);

  // Sync tray whenever connection status or pending approvals change
  useEffect(() => {
    const sync = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_tray_status', {
          connectionStatus: statusLabel(connectionStatus),
          pendingApprovals: pendingCount,
        });
      } catch {
        // Not in Tauri context or macOS-only command
      }
    };
    sync();
  }, [connectionStatus, pendingCount]);
}
