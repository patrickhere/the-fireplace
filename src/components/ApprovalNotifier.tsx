// ---------------------------------------------------------------------------
// ApprovalNotifier — fires native macOS notifications for pending approvals
// ---------------------------------------------------------------------------
// Sends notifications with Approve/Deny action buttons when new approval
// requests arrive. Also mounts the notification action listener so that
// button taps resolve approvals directly without opening the app window.

import { useEffect, useRef } from 'react';
import { useApprovalsStore } from '@/stores/approvals';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationActions, APPROVAL_ACTION_TYPE_ID } from '@/hooks/useNotificationActions';
import { useAgentsStore } from '@/stores/agents';

export function ApprovalNotifier() {
  const { pendingRequests } = useApprovalsStore();
  const { permitted, requestPermission, notify } = useNotifications();
  const { agents } = useAgentsStore();
  const notifiedIds = useRef(new Set<string>());

  // Mount the notification action listener (registers action types + onAction)
  useNotificationActions();

  // Request permission once on mount
  useEffect(() => {
    if (!permitted) {
      requestPermission();
    }
  }, [permitted, requestPermission]);

  // Notify for new pending requests
  useEffect(() => {
    if (!permitted) return;

    for (const req of pendingRequests) {
      const key = req.id ?? `${req.command}-${req.receivedAt}`;
      if (notifiedIds.current.has(key)) continue;
      notifiedIds.current.add(key);

      const agent = req.agentId ? agents.find((a) => a.id === req.agentId) : undefined;
      const agentLabel = agent
        ? `${agent.identity?.emoji ?? ''} ${agent.identity?.name ?? agent.name ?? req.agentId}`.trim()
        : (req.agentId ?? 'Unknown agent');

      const truncatedCmd =
        req.command.length > 120 ? req.command.slice(0, 120) + '...' : req.command;

      // Send notification with action buttons when we have a valid request ID
      if (req.id) {
        notify({
          title: `Approval: ${agentLabel}`,
          body: truncatedCmd,
          urgency: 'critical',
          actionTypeId: APPROVAL_ACTION_TYPE_ID,
          extra: {
            requestId: req.id,
          },
        });
      } else {
        // Fallback: no request ID means we cannot attach actions
        notify({
          title: `Approval: ${agentLabel}`,
          body: truncatedCmd,
          urgency: 'critical',
        });
      }
    }
  }, [pendingRequests, permitted, notify, agents]);

  // Prune notified IDs when requests are resolved (prevent unbounded growth)
  useEffect(() => {
    const activeIds = new Set(pendingRequests.map((r) => r.id ?? `${r.command}-${r.receivedAt}`));
    for (const id of notifiedIds.current) {
      if (!activeIds.has(id)) {
        notifiedIds.current.delete(id);
      }
    }
  }, [pendingRequests]);

  return null;
}
