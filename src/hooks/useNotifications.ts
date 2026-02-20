// ---------------------------------------------------------------------------
// Native Notification Hook
// ---------------------------------------------------------------------------
// Wraps tauri-plugin-notification for sending OS-level notifications.
// Falls back gracefully when running in a browser (non-Tauri) context.

import { useCallback, useEffect, useState } from 'react';

type NotificationUrgency = 'low' | 'normal' | 'critical';

interface NotificationOptions {
  title: string;
  body: string;
  urgency?: NotificationUrgency;
  /** Action type ID to attach action buttons (e.g. Approve/Deny). */
  actionTypeId?: string;
  /** Extra key-value payload stored with the notification. */
  extra?: Record<string, string>;
}

interface UseNotificationsReturn {
  /** Whether notification permissions have been granted */
  permitted: boolean;
  /** Request permission to show notifications */
  requestPermission: () => Promise<boolean>;
  /** Send a native notification */
  notify: (options: NotificationOptions) => Promise<void>;
}

export type { NotificationOptions };

export function useNotifications(): UseNotificationsReturn {
  const [permitted, setPermitted] = useState(false);

  // Check permission on mount
  useEffect(() => {
    const check = async () => {
      try {
        const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
        const granted = await isPermissionGranted();
        setPermitted(granted);
      } catch {
        // Not in Tauri context
        setPermitted(false);
      }
    };
    check();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { isPermissionGranted, requestPermission: reqPerm } =
        await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await reqPerm();
        granted = result === 'granted';
      }
      setPermitted(granted);
      return granted;
    } catch {
      return false;
    }
  }, []);

  const notify = useCallback(
    async (options: NotificationOptions): Promise<void> => {
      if (!permitted) {
        console.warn('[Notifications] Not permitted');
        return;
      }
      try {
        if (options.actionTypeId) {
          // Use the plugin's sendNotification for action-enabled notifications
          const { sendNotification } = await import('@tauri-apps/plugin-notification');
          sendNotification({
            title: options.title,
            body: options.body,
            actionTypeId: options.actionTypeId,
            sound: options.urgency === 'critical' ? 'default' : undefined,
            extra: options.extra,
          });
        } else {
          // Use Tauri command for basic notifications
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('send_notification', {
            title: options.title,
            body: options.body,
            urgency: options.urgency ?? 'normal',
          });
        }
      } catch (err) {
        console.warn('[Notifications] Failed to send notification:', err);
      }
    },
    [permitted]
  );

  return { permitted, requestPermission, notify };
}
