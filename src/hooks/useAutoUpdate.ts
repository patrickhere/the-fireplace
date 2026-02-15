// ---------------------------------------------------------------------------
// Auto-Update Hook (macOS only)
// ---------------------------------------------------------------------------
// Uses tauri-plugin-updater to check for and install updates.
// Checks on launch and then periodically every 30 minutes.

import { useEffect, useState, useCallback } from 'react';

interface UpdateStatus {
  /** Whether an update is available */
  available: boolean;
  /** Version string of the available update, if any */
  version: string | null;
  /** Whether the update is currently being downloaded */
  downloading: boolean;
  /** Whether the update has been downloaded and is ready to install */
  ready: boolean;
  /** Error message, if the update check failed */
  error: string | null;
}

interface UseAutoUpdateReturn extends UpdateStatus {
  /** Manually trigger an update check */
  checkForUpdate: () => Promise<void>;
  /** Download and install the available update */
  installUpdate: () => Promise<void>;
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function useAutoUpdate(): UseAutoUpdateReturn {
  const [status, setStatus] = useState<UpdateStatus>({
    available: false,
    version: null,
    downloading: false,
    ready: false,
    error: null,
  });

  const checkForUpdate = useCallback(async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        setStatus((prev) => ({
          ...prev,
          available: true,
          version: update.version,
          error: null,
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          available: false,
          version: null,
          error: null,
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update check failed';
      console.warn('[AutoUpdate] Check failed:', message);
      setStatus((prev) => ({
        ...prev,
        error: message,
      }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (!update) {
        setStatus((prev) => ({ ...prev, available: false, version: null }));
        return;
      }

      setStatus((prev) => ({ ...prev, downloading: true }));

      await update.downloadAndInstall();

      setStatus((prev) => ({
        ...prev,
        downloading: false,
        ready: true,
      }));

      // The app will restart automatically after install on macOS.
      // If manual relaunch is needed, use tauri's process.relaunch().
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update install failed';
      console.error('[AutoUpdate] Install failed:', message);
      setStatus((prev) => ({
        ...prev,
        downloading: false,
        error: message,
      }));
    }
  }, []);

  // Check on mount and periodically
  useEffect(() => {
    // Delay initial check by 5 seconds to not slow down startup
    const initialTimeout = setTimeout(() => {
      checkForUpdate();
    }, 5000);

    const interval = setInterval(() => {
      checkForUpdate();
    }, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  return {
    ...status,
    checkForUpdate,
    installUpdate,
  };
}
