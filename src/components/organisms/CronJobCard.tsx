import { useCallback, useState } from 'react';
import { useCronStore, type CronJob } from '@/stores/cron';
import type { Agent } from '@/stores/agents';
import { CronExecHistory } from '@/components/organisms/CronExecHistory';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { StatusDot } from '@/components/atoms/StatusDot';
import { StatusPill } from '@/components/atoms/StatusPill';

function formatEveryMs(ms: number): string {
  if (ms >= 86_400_000 && ms % 86_400_000 === 0) return `${(ms / 86_400_000).toString()}d`;
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) return `${(ms / 3_600_000).toString()}h`;
  if (ms >= 60_000 && ms % 60_000 === 0) return `${(ms / 60_000).toString()}m`;
  if (ms >= 1_000 && ms % 1_000 === 0) return `${(ms / 1_000).toString()}s`;
  return `${ms.toString()}ms`;
}

function formatSchedule(schedule: CronJob['schedule']): string {
  switch (schedule.kind) {
    case 'at':
      return `At ${schedule.at}`;
    case 'every':
      return `Every ${formatEveryMs(schedule.everyMs)}`;
    case 'cron':
      return `Cron: ${schedule.expr}`;
    default:
      return 'Unknown schedule';
  }
}

function formatRelativeTime(ms: number | undefined): string {
  if (!ms) return '--';
  const diff = ms - Date.now();
  if (diff < 0) {
    const ago = Math.abs(diff);
    if (ago < 60000) return `${Math.floor(ago / 1000)}s ago`;
    if (ago < 3600000) return `${Math.floor(ago / 60000)}m ago`;
    return `${Math.floor(ago / 3600000)}h ago`;
  }
  if (diff < 60000) return `in ${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
  return `in ${Math.floor(diff / 3600000)}h`;
}

function statusColor(status: string | undefined): 'online' | 'warning' | 'error' | 'offline' {
  if (!status) return 'offline';
  switch (status) {
    case 'ok':
    case 'success':
      return 'online';
    case 'error':
    case 'failed':
      return 'error';
    case 'skipped':
      return 'warning';
    case 'running':
      return 'warning';
    default:
      return 'offline';
  }
}

function findAgent(agents: Agent[], agentId: string | undefined): Agent | undefined {
  if (!agentId) return undefined;
  return agents.find((agent) => agent.id === agentId);
}

function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-sm p-4">
        <p className="mb-4 text-sm text-zinc-300">{message}</p>
        <DialogFooter className="border-t-0 p-0">
          <button
            onClick={onCancel}
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            type="button"
          >
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CronJobCard({ job, agents }: { job: CronJob; agents: Agent[] }) {
  const { updateJob, removeJob, triggerJob, loadRuns, runHistory } = useCronStore();

  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const runs = runHistory[job.id] ?? [];
  const agent = findAgent(agents, job.agentId);

  const handleToggleEnabled = useCallback(async () => {
    await updateJob(job.id, { enabled: !job.enabled });
  }, [job.id, job.enabled, updateJob]);

  const handleTrigger = useCallback(async () => {
    setIsTriggering(true);
    await triggerJob(job.id);
    setIsTriggering(false);
  }, [job.id, triggerJob]);

  const handleDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    await removeJob(job.id);
  }, [job.id, removeJob]);

  const handleExpand = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      loadRuns(job.id);
    }
  }, [expanded, job.id, loadRuns]);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/50"
        onClick={handleExpand}
      >
        <td className="py-2.5 pr-2 pl-3">
          <StatusDot
            status={statusColor(job.state.lastStatus)}
            pulse={job.state.lastStatus === 'running'}
          />
        </td>

        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">{job.name}</span>
            {agent && (
              <span className="inline-flex items-center gap-0.5 rounded bg-zinc-700/50 px-1.5 py-0.5 text-xs text-zinc-300">
                <span>{agent.identity?.emoji ?? '?'}</span>
                <span className="text-zinc-400">{agent.identity?.name ?? agent.id}</span>
              </span>
            )}
          </div>
          {job.description && <div className="text-xs text-zinc-500">{job.description}</div>}
          {job.agentId && !agent && (
            <span className="text-xs text-zinc-600">agent: {job.agentId}</span>
          )}
        </td>

        <td className="py-2.5 pr-3">
          <span className="text-sm text-zinc-300">{formatSchedule(job.schedule)}</span>
        </td>

        <td className="py-2.5 pr-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleToggleEnabled();
            }}
            className="inline-flex"
            type="button"
          >
            <StatusPill
              status={job.enabled ? 'active' : 'offline'}
              label={job.enabled ? 'On' : 'Off'}
            />
          </button>
        </td>

        <td className="py-2.5 pr-3 text-xs text-zinc-400">
          {job.state.runningAtMs ? (
            <span className="text-amber-400">Running...</span>
          ) : (
            formatRelativeTime(job.state.nextRunAtMs)
          )}
        </td>

        <td className="py-2.5 pr-3">
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleTrigger}
              disabled={isTriggering}
              className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
              type="button"
            >
              {isTriggering ? '...' : 'Run Now'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
              type="button"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-zinc-800">
          <td colSpan={6} className="bg-zinc-900/50 p-3">
            <div className="space-y-3">
              <div className="grid gap-x-6 gap-y-1 text-xs md:grid-cols-4">
                <div>
                  <span className="text-zinc-500">Last run:</span>{' '}
                  <span className="text-zinc-300">
                    {job.state.lastRunAtMs
                      ? new Date(job.state.lastRunAtMs).toLocaleString()
                      : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Duration:</span>{' '}
                  <span className="text-zinc-300">
                    {job.state.lastDurationMs !== undefined
                      ? `${job.state.lastDurationMs}ms`
                      : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Status:</span>{' '}
                  <span className="text-zinc-300">{job.state.lastStatus ?? '--'}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Consecutive errors:</span>{' '}
                  <span className={job.state.consecutiveErrors ? 'text-red-400' : 'text-zinc-300'}>
                    {job.state.consecutiveErrors ?? 0}
                  </span>
                </div>
              </div>

              {job.state.lastError && (
                <div className="rounded-md bg-red-500/10 p-2 text-xs text-red-400">
                  {job.state.lastError}
                </div>
              )}

              <div className="grid gap-x-6 gap-y-1 text-xs md:grid-cols-3">
                <div>
                  <span className="text-zinc-500">Session target:</span>{' '}
                  <span className="text-zinc-300">{job.sessionTarget}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Wake mode:</span>{' '}
                  <span className="text-zinc-300">{job.wakeMode}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Payload:</span>{' '}
                  <span className="text-zinc-300">{job.payload.kind}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Created:</span>{' '}
                  <span className="text-zinc-300">
                    {new Date(job.createdAtMs).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Updated:</span>{' '}
                  <span className="text-zinc-300">
                    {new Date(job.updatedAtMs).toLocaleString()}
                  </span>
                </div>
                {job.deleteAfterRun && (
                  <div>
                    <span className="text-amber-400">Deletes after run</span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold text-zinc-500">Run History</h4>
                <CronExecHistory runs={runs} />
              </div>
            </div>
          </td>
        </tr>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        message={`Delete cron job "${job.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
