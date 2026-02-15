// ---------------------------------------------------------------------------
// Cron & Automation View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useCronStore } from '@/stores/cron';
import { useConnectionStore } from '@/stores/connection';
import type { CronJob, CronAddParams, CronSchedule, CronPayload, CronRunLogEntry } from '@/stores/cron';

// ---- Helpers --------------------------------------------------------------

function formatSchedule(schedule: CronSchedule): string {
  switch (schedule.kind) {
    case 'at':
      return `At ${schedule.at ?? 'unknown'}`;
    case 'every':
      return `Every ${schedule.every ?? 'unknown'}`;
    case 'cron':
      return `Cron: ${schedule.cron ?? 'unknown'}`;
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
      return 'bg-blue-500 animate-pulse';
    default:
      return 'bg-zinc-500';
  }
}

// ---- Confirm Dialog -------------------------------------------------------

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <p className="mb-4 text-sm text-zinc-300">{message}</p>
        <div className="flex justify-end gap-2">
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
        </div>
      </div>
    </div>
  );
}

// ---- Run History Table ----------------------------------------------------

function RunHistoryTable({ runs }: { runs: CronRunLogEntry[] }) {
  if (runs.length === 0) {
    return <p className="text-xs text-zinc-600">No run history available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-500">
            <th className="pb-1 pr-3 font-medium">Run ID</th>
            <th className="pb-1 pr-3 font-medium">Started</th>
            <th className="pb-1 pr-3 font-medium">Duration</th>
            <th className="pb-1 pr-3 font-medium">Status</th>
            <th className="pb-1 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.runId} className="border-b border-zinc-800">
              <td className="py-1.5 pr-3 font-mono text-zinc-400">
                {run.runId.slice(0, 8)}
              </td>
              <td className="py-1.5 pr-3 text-zinc-400">
                {new Date(run.startedAtMs).toLocaleString()}
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

// ---- Add Job Form ---------------------------------------------------------

function AddJobForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (params: CronAddParams) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleKind, setScheduleKind] = useState<'at' | 'every' | 'cron'>('every');
  const [scheduleValue, setScheduleValue] = useState('');
  const [timezone, setTimezone] = useState('');
  const [sessionTarget, setSessionTarget] = useState<'main' | 'isolated'>('main');
  const [wakeMode, setWakeMode] = useState<'next-heartbeat' | 'now'>('now');
  const [payloadKind, setPayloadKind] = useState<'systemEvent' | 'agentTurn'>('agentTurn');
  const [payloadMessage, setPayloadMessage] = useState('');
  const [agentId, setAgentId] = useState('');
  const [enabled, setEnabled] = useState(true);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !scheduleValue.trim()) return;

      const schedule: CronSchedule = {
        kind: scheduleKind,
        [scheduleKind]: scheduleValue.trim(),
        timezone: timezone.trim() || undefined,
      };

      const payload: CronPayload = {
        kind: payloadKind,
        message: payloadMessage.trim() || undefined,
      };

      onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        agentId: agentId.trim() || undefined,
        enabled,
        schedule,
        sessionTarget,
        wakeMode,
        payload,
      });
    },
    [name, description, scheduleKind, scheduleValue, timezone, sessionTarget, wakeMode, payloadKind, payloadMessage, agentId, enabled, onSubmit]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-amber-500/30 bg-zinc-900 p-3"
    >
      <h3 className="text-sm font-semibold text-zinc-200">New Cron Job</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
            placeholder="My cron job"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Agent ID</label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-500">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
          placeholder="Optional description"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Schedule Type</label>
          <select
            value={scheduleKind}
            onChange={(e) => setScheduleKind(e.target.value as 'at' | 'every' | 'cron')}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="every">Every (interval)</option>
            <option value="cron">Cron expression</option>
            <option value="at">At (one-time)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            {scheduleKind === 'cron' ? 'Cron Expression *' : scheduleKind === 'at' ? 'Date/Time *' : 'Interval *'}
          </label>
          <input
            type="text"
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
            placeholder={scheduleKind === 'cron' ? '*/5 * * * *' : scheduleKind === 'at' ? '2025-01-01T12:00:00Z' : '30m'}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Timezone</label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
            placeholder="UTC"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Session Target</label>
          <select
            value={sessionTarget}
            onChange={(e) => setSessionTarget(e.target.value as 'main' | 'isolated')}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="main">Main session</option>
            <option value="isolated">Isolated session</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Wake Mode</label>
          <select
            value={wakeMode}
            onChange={(e) => setWakeMode(e.target.value as 'next-heartbeat' | 'now')}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="now">Immediately</option>
            <option value="next-heartbeat">Next heartbeat</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Payload Type</label>
          <select
            value={payloadKind}
            onChange={(e) => setPayloadKind(e.target.value as 'systemEvent' | 'agentTurn')}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="agentTurn">Agent Turn</option>
            <option value="systemEvent">System Event</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-500">Payload Message</label>
        <input
          type="text"
          value={payloadMessage}
          onChange={(e) => setPayloadMessage(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
          placeholder="Optional message to send"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="job-enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
        />
        <label htmlFor="job-enabled" className="text-xs text-zinc-400">
          Enable immediately
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || !scheduleValue.trim()}
          className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Create Job
        </button>
      </div>
    </form>
  );
}

// ---- Job Row (Expandable) -------------------------------------------------

function JobRow({ job }: { job: CronJob }) {
  const { updateJob, removeJob, triggerJob, loadRuns, runHistory } = useCronStore();

  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const runs = runHistory[job.id] ?? [];

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
      {/* Main Row */}
      <tr
        className="cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/50"
        onClick={handleExpand}
      >
        {/* Status Dot */}
        <td className="py-2.5 pl-3 pr-2">
          <div className={`h-2 w-2 rounded-full ${statusColor(job.state.lastStatus)}`} />
        </td>

        {/* Name */}
        <td className="py-2.5 pr-3">
          <div className="text-sm font-medium text-zinc-100">{job.name}</div>
          {job.description && (
            <div className="text-xs text-zinc-500">{job.description}</div>
          )}
          {job.agentId && (
            <span className="text-xs text-zinc-600">agent: {job.agentId}</span>
          )}
        </td>

        {/* Schedule */}
        <td className="py-2.5 pr-3">
          <span className="text-sm text-zinc-300">{formatSchedule(job.schedule)}</span>
        </td>

        {/* Enabled Toggle */}
        <td className="py-2.5 pr-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleEnabled();
            }}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              job.enabled
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-zinc-700 text-zinc-500'
            }`}
            type="button"
          >
            {job.enabled ? 'On' : 'Off'}
          </button>
        </td>

        {/* Next Run */}
        <td className="py-2.5 pr-3 text-xs text-zinc-400">
          {job.state.runningAtMs ? (
            <span className="text-blue-400">Running...</span>
          ) : (
            formatRelativeTime(job.state.nextRunAtMs)
          )}
        </td>

        {/* Actions */}
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

      {/* Expanded Detail Row */}
      {expanded && (
        <tr className="border-b border-zinc-800">
          <td colSpan={6} className="bg-zinc-900/50 p-3">
            <div className="space-y-3">
              {/* Last Run Details */}
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

              {/* Job Config */}
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

              {/* Run History */}
              <div>
                <h4 className="mb-2 text-xs font-semibold text-zinc-500">Run History</h4>
                <RunHistoryTable runs={runs} />
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

// ---- Main Cron View -------------------------------------------------------

export function Cron() {
  const { jobs, isLoading, error, loadJobs } = useCronStore();
  const { status } = useConnectionStore();

  const [showAddForm, setShowAddForm] = useState(false);

  // Load on mount
  useEffect(() => {
    if (status === 'connected') {
      loadJobs();
    }
  }, [status, loadJobs]);

  const handleAddJob = useCallback(
    async (params: CronAddParams) => {
      const { addJob } = useCronStore.getState();
      await addJob(params);
      setShowAddForm(false);
    },
    []
  );

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      // Running jobs first, then by next run time
      if (a.state.runningAtMs && !b.state.runningAtMs) return -1;
      if (!a.state.runningAtMs && b.state.runningAtMs) return 1;
      const aNext = a.state.nextRunAtMs ?? Infinity;
      const bNext = b.state.nextRunAtMs ?? Infinity;
      return aNext - bNext;
    });
  }, [jobs]);

  const enabledCount = jobs.filter((j) => j.enabled).length;
  const errorCount = jobs.filter((j) => j.state.lastStatus === 'error').length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Cron & Automation</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
            <span>{enabledCount} enabled</span>
            {errorCount > 0 && (
              <span className="text-red-400">{errorCount} with errors</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadJobs()}
            disabled={isLoading}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
            type="button"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            {showAddForm ? 'Cancel' : 'Add Job'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Add Job Form */}
        {showAddForm && (
          <div className="mb-4">
            <AddJobForm onSubmit={handleAddJob} onCancel={() => setShowAddForm(false)} />
          </div>
        )}

        {isLoading && jobs.length === 0 ? (
          <div className="text-sm text-zinc-400">Loading cron jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-4 text-center">
            <p className="text-sm text-zinc-500">No cron jobs configured.</p>
            <p className="mt-1 text-xs text-zinc-600">
              Click "Add Job" to create a scheduled automation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-xs text-zinc-500">
                  <th className="w-8 pb-2 pl-3 pr-2 font-medium" />
                  <th className="pb-2 pr-3 font-medium">Name</th>
                  <th className="pb-2 pr-3 font-medium">Schedule</th>
                  <th className="pb-2 pr-3 font-medium">Enabled</th>
                  <th className="pb-2 pr-3 font-medium">Next Run</th>
                  <th className="pb-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
