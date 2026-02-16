export function SessionReplay({
  sessionKey,
  onClose,
}: {
  sessionKey: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
          <h2 className="text-lg font-semibold text-zinc-100">Session Replay: {sessionKey}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4 text-zinc-500">Loading...</div>
      </div>
    </div>
  );
}
