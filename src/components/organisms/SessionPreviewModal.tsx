import { useSessionsStore } from '@/stores/sessions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function SessionPreviewModal() {
  const { selectedSession, showPreviewModal, setShowPreviewModal } = useSessionsStore();

  if (!showPreviewModal || !selectedSession) return null;

  return (
    <Dialog open={showPreviewModal} onOpenChange={(next) => !next && setShowPreviewModal(false)}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Session Preview</DialogTitle>
          <p className="text-sm text-zinc-400">{selectedSession.key}</p>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto p-1" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {selectedSession.messages.map((msg, idx) => (
            <div
              key={`msg-${msg.timestamp}-${msg.role}-${idx}`}
              className={`rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'border border-amber-500/20 bg-amber-500/10'
                  : 'border border-zinc-700 bg-zinc-800'
              }`}
            >
              <div className="mb-1 text-xs font-semibold text-zinc-400 uppercase">{msg.role}</div>
              <div className="text-sm whitespace-pre-wrap text-zinc-100">{msg.content}</div>
              {msg.timestamp && (
                <div className="mt-2 text-xs text-zinc-500">
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
