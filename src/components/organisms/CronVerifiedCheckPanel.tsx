interface VerifiedCheckEntry {
  command: string;
  output: string;
  isError?: boolean;
}

interface VerifiedCronRunEntry {
  ts?: number;
  runAtMs?: number;
  durationMs?: number;
  sessionId?: string;
  status?: string;
  error?: string;
  summary?: string;
}

function renderVerifiedOutput(entry: VerifiedCheckEntry) {
  if (!entry.command.includes('cron.runs')) {
    return (
      <pre className="overflow-x-auto text-xs whitespace-pre-wrap text-zinc-200">
        {entry.output}
      </pre>
    );
  }

  try {
    const parsed = JSON.parse(entry.output) as { entries?: VerifiedCronRunEntry[] };
    const rows = parsed.entries ?? [];
    const deterministicRows = rows.filter((row) => row.summary === 'verified.health.pulse');
    const hiddenCount = rows.length - deterministicRows.length;

    return (
      <div className="space-y-2">
        <div className="text-xs text-zinc-400">
          Showing deterministic pulse runs only (`summary: verified.health.pulse`).
          {hiddenCount > 0 ? ` Hidden pre-cutover rows: ${hiddenCount}.` : ''}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-zinc-500">
                <th className="pr-2 pb-1 font-medium">Run At</th>
                <th className="pr-2 pb-1 font-medium">Status</th>
                <th className="pr-2 pb-1 font-medium">Duration</th>
                <th className="pr-2 pb-1 font-medium">Session</th>
                <th className="pb-1 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {deterministicRows.map((row, idx) => (
                <tr
                  key={`${row.sessionId ?? row.runAtMs ?? row.ts ?? idx}`}
                  className="border-b border-zinc-800"
                >
                  <td className="py-1 pr-2 text-zinc-300">
                    {new Date(row.runAtMs ?? row.ts ?? Date.now()).toLocaleString()}
                  </td>
                  <td className="py-1 pr-2 text-zinc-300">{row.status ?? '--'}</td>
                  <td className="py-1 pr-2 text-zinc-300">
                    {typeof row.durationMs === 'number' ? `${row.durationMs}ms` : '--'}
                  </td>
                  <td className="py-1 pr-2 font-mono text-zinc-400">
                    {(row.sessionId ?? '--').slice(0, 8)}
                  </td>
                  <td className="py-1 text-red-400">{row.error ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
            Show raw JSON
          </summary>
          <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap text-zinc-200">
            {entry.output}
          </pre>
        </details>
      </div>
    );
  } catch {
    return (
      <pre className="overflow-x-auto text-xs whitespace-pre-wrap text-zinc-200">
        {entry.output}
      </pre>
    );
  }
}

export function CronVerifiedCheckPanel({
  entries,
  onClear,
}: {
  entries: VerifiedCheckEntry[];
  onClear: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Verified Health Check Output</h3>
        <button
          onClick={onClear}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
          type="button"
        >
          Clear
        </button>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={`${entry.command}-${entry.output.slice(0, 16)}`}
            className={`rounded border p-2 ${entry.isError ? 'border-red-700 bg-red-950/20' : 'border-zinc-700 bg-zinc-950/30'}`}
          >
            <div className="mb-1 text-xs text-zinc-400">{entry.command}</div>
            {renderVerifiedOutput(entry)}
          </div>
        ))}
      </div>
    </div>
  );
}
