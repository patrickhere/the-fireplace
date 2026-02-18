// ---------------------------------------------------------------------------
// Shared State Indicator Components
// ---------------------------------------------------------------------------
// LoadingSpinner, EmptyState, ErrorState — used across all data views.

// ---- LoadingSpinner --------------------------------------------------------

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}

// ---- LoadingSkeleton -------------------------------------------------------

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex animate-pulse gap-3">
          <div className="h-10 w-10 flex-none rounded-lg bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-zinc-800" />
            <div className="h-3 w-1/3 rounded bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- EmptyState -----------------------------------------------------------

export function EmptyState({
  icon = '\u25cb',
  message,
  detail,
  action,
  onAction,
}: {
  icon?: string;
  message: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="text-2xl text-zinc-700">{icon}</span>
      <p className="text-sm font-medium text-zinc-500">{message}</p>
      {detail && <p className="max-w-xs text-xs text-zinc-600">{detail}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ---- ErrorState -----------------------------------------------------------

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
        <span className="text-lg text-red-400">!</span>
      </div>
      <div>
        <p className="text-sm font-medium text-red-400">Failed to load</p>
        <p className="mt-1 max-w-xs text-xs text-zinc-500">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          Retry
        </button>
      )}
    </div>
  );
}
