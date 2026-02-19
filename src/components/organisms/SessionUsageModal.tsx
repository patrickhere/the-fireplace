import { formatSessionKey } from '@/lib/utils';
import { useSessionsStore } from '@/stores/sessions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function SessionUsageModal() {
  const { usageStats, showUsageModal, setShowUsageModal } = useSessionsStore();

  if (!showUsageModal || !usageStats) return null;

  return (
    <Dialog open={showUsageModal} onOpenChange={(next) => !next && setShowUsageModal(false)}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Token Usage</DialogTitle>
          <p className="text-sm text-zinc-400">
            Total: {usageStats.totalTokens.toLocaleString()} tokens
          </p>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto p-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <div className="text-xs text-zinc-400">Total Tokens</div>
              <div className="text-lg font-semibold text-zinc-100">
                {usageStats.totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <div className="text-xs text-zinc-400">Input Tokens</div>
              <div className="text-lg font-semibold text-zinc-100">
                {usageStats.totalInputTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <div className="text-xs text-zinc-400">Output Tokens</div>
              <div className="text-lg font-semibold text-zinc-100">
                {usageStats.totalOutputTokens.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-100">Sessions</h3>
            {usageStats.sessions.map((session, idx) => (
              <div
                key={`usage-${session.key}-${idx}`}
                className="rounded-lg border border-zinc-700 bg-zinc-800 p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-100">
                    {formatSessionKey(session.key)}
                  </span>
                  <span className="text-xs text-zinc-400">{session.model || 'default'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-400">Total:</span>{' '}
                    <span className="text-zinc-100">{session.totalTokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">In:</span>{' '}
                    <span className="text-zinc-100">{session.inputTokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Out:</span>{' '}
                    <span className="text-zinc-100">{session.outputTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
