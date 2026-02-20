// ---------------------------------------------------------------------------
// Notification Action Handler
// ---------------------------------------------------------------------------
// Registers macOS notification action types (Approve / Deny buttons) and
// listens for user interactions. When an action fires, resolves the approval
// in the store and shows a confirmation toast.

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useApprovalsStore } from '@/stores/approvals';

/** The action type ID attached to approval notifications. */
export const APPROVAL_ACTION_TYPE_ID = 'exec-approval';

/** Action IDs used inside the action type. */
const ACTION_APPROVE = 'approve';
const ACTION_DENY = 'deny';

/**
 * Registers the exec-approval action type with the Tauri notification plugin
 * and listens for action callbacks. Must be mounted once at the app root.
 */
export function useNotificationActions(): void {
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    let cleanupListener: (() => void) | undefined;

    const setup = async () => {
      try {
        const { registerActionTypes, onAction, onNotificationReceived } =
          await import('@tauri-apps/plugin-notification');

        // Register the action type with two buttons.
        // On iOS this enables interactive notification buttons.
        // On macOS desktop the buttons may not render (depends on plugin
        // version and UNUserNotificationCenter support), but the action
        // type registration itself is harmless.
        await registerActionTypes([
          {
            id: APPROVAL_ACTION_TYPE_ID,
            actions: [
              {
                id: ACTION_APPROVE,
                title: 'Approve',
                foreground: false,
              },
              {
                id: ACTION_DENY,
                title: 'Deny',
                destructive: true,
                foreground: false,
              },
            ],
          },
        ]);

        // Listen for action button taps (fires on iOS; may fire on macOS
        // if the plugin wires up UNNotificationAction responses).
        const actionListener = await onAction((notification) => {
          handleNotificationAction(notification);
        });

        // Also listen for notification body clicks. On macOS desktop this
        // is the primary interaction path -- clicking the notification
        // banner focuses the app and navigates to /approvals.
        const receivedListener = await onNotificationReceived((notification) => {
          handleNotificationClick(notification);
        });

        cleanupListener = () => {
          actionListener.unregister();
          receivedListener.unregister();
        };
      } catch (err) {
        // Not in Tauri context or plugin unavailable
        console.warn('[NotificationActions] Setup failed:', err);
      }
    };

    setup();

    return () => {
      cleanupListener?.();
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Internal handler
// ---------------------------------------------------------------------------

interface NotificationPayload {
  actionTypeId?: string;
  extra?: Record<string, unknown>;
}

function handleNotificationAction(notification: NotificationPayload): void {
  const extra = notification.extra;
  if (!extra) {
    // No extra data -- just a plain notification click. Focus the app and
    // navigate to approvals.
    focusAndNavigate('/approvals');
    return;
  }

  const requestId = typeof extra['requestId'] === 'string' ? extra['requestId'] : undefined;
  const actionId = typeof extra['actionId'] === 'string' ? extra['actionId'] : undefined;

  if (!requestId) {
    // Notification clicked without a specific action -- navigate to approvals
    focusAndNavigate('/approvals');
    return;
  }

  if (actionId === ACTION_APPROVE || actionId === ACTION_DENY) {
    const decision = actionId === ACTION_APPROVE ? 'approve' : 'deny';
    const label = decision === 'approve' ? 'Approved' : 'Denied';

    useApprovalsStore
      .getState()
      .resolveApproval(requestId, decision)
      .then(() => {
        toast.success(`${label} from notification`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to ${decision}: ${msg}`);
      });
  } else {
    // Clicked the notification body itself (no specific action button)
    focusAndNavigate('/approvals');
  }
}

/**
 * Handles a click on the notification body (not an action button).
 * Focuses the app and navigates to /approvals.
 */
function handleNotificationClick(notification: NotificationPayload): void {
  // If the notification has an approval action type, navigate to approvals
  if (notification.actionTypeId === APPROVAL_ACTION_TYPE_ID) {
    focusAndNavigate('/approvals');
  }
}

async function focusAndNavigate(route: string): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();

    // Use the same tray navigation bridge if available
    if (typeof window !== 'undefined') {
      const trayNav = (window as unknown as Record<string, unknown>)['__trayNav'] as
        | ((r: string) => void)
        | undefined;
      if (trayNav) {
        trayNav(route);
      } else {
        window.location.hash = `#${route}`;
      }
    }
  } catch {
    // Not in Tauri context
  }
}
