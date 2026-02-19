import type { CronRunLogEntry } from '@/stores/cron';

function statusColor(status: string | undefined): string {
  if (!status) return 'bg-zinc-500';
  switch (status) {
    case 'ok':
    case 'success':
      return 'bg-emerald-500';
    case 'error':
    case 'failed':
      return 'bg-red-500';
    case 'skipped':
      return 'bg-amber-500';
    case 'running':
      return 'bg-amber-500 animate-pulse';
    default:
      return 'bg-zinc-500';
  }
}

export function CronExecHistory({ runs }: { runs: CronRunLogEntry[] }) {
  if (runs.length === 0) {
    return <p className="text-xs text-zinc-600">No run history available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-500">
            <th className="pr-3 pb-1 font-medium">Session</th>
            <th className="pr-3 pb-1 font-medium">Run At</th>
            <th className="pr-3 pb-1 font-medium">Duration</th>
            <th className="pr-3 pb-1 font-medium">Status</th>
            <th className="pb-1 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.sessionId ?? `${run.jobId}-${run.runAtMs ?? run.ts ?? 0}`}
              className="border-b border-zinc-800"
            >
              <td className="py-1.5 pr-3 font-mono text-zinc-400">
                {(run.sessionId ?? '--').slice(0, 8)}
              </td>
              <td className="py-1.5 pr-3 text-zinc-400">
                {new Date(run.runAtMs ?? run.ts ?? Date.now()).toLocaleString()}
              </td>
              <td className="py-1.5 pr-3 text-zinc-400">
                {run.durationMs !== undefined ? `${run.durationMs}ms` : '--'}
              </td>
              <td className="py-1.5 pr-3">
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${statusColor(run.status)}`} />
                  <span className="text-zinc-400">{run.status}</span>
                </div>
              </td>
              <td className="py-1.5 text-red-400">{run.error ?? '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
