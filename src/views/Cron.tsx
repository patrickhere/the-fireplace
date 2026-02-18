// ---------------------------------------------------------------------------
// Cron & Automation View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useCronStore } from '@/stores/cron';
import { useConnectionStore } from '@/stores/connection';
import { useAgentsStore, type Agent } from '@/stores/agents';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';
import type {
  CronJob,
  CronAddParams,
  CronSchedule,
  CronPayload,
  CronRunLogEntry,
} from '@/stores/cron';

// No hardcoded pulse cron ID — looked up dynamically from jobs list.

interface VerifiedCheckEntry {
  command: string;
  output: string;
  isError?: boolean;
}

interface VerifiedCronRunEntry {
  ts?: number;
  jobId?: string;
  action?: string;
  status?: string;
  runAtMs?: number;
  durationMs?: number;
  sessionId?: string;
  sessionKey?: string;
  error?: string;
  summary?: string;
}

// ---- Quick-Create Templates -----------------------------------------------

interface CronTemplate {
  label: string;
  name: string;
  agentId: string;
  scheduleKind: 'at' | 'every' | 'cron';
  scheduleValue: string;
  payloadKind: 'systemEvent' | 'agentTurn';
  payloadMessage: string;
  description: string;
}

const CRON_TEMPLATES: CronTemplate[] = [
  {
    label: 'System Audit',
    name: 'System Audit',
    agentId: 'buer',
    scheduleKind: 'every',
    scheduleValue: '6h',
    payloadKind: 'agentTurn',
    payloadMessage: 'Run a system audit',
    description: 'Audit codebase, report optimization opportunities',
  },
  {
    label: 'Context Cleanup',
    name: 'Context Cleanup',
    agentId: 'alloces',
    scheduleKind: 'every',
    scheduleValue: '4h',
    payloadKind: 'agentTurn',
    payloadMessage: 'Check session sizes, compact bloated sessions',
    description: 'Check session sizes, compact bloated sessions',
  },
  {
    label: 'Security Scan',
    name: 'Security Scan',
    agentId: 'andromalius',
    scheduleKind: 'cron',
    scheduleValue: '0 3 * * *',
    payloadKind: 'agentTurn',
    payloadMessage: 'Review access logs, check for anomalies',
    description: 'Review access logs, check for anomalies',
  },
  {
    label: 'Knowledge Sync',
    name: 'Knowledge Sync',
    agentId: 'paimon',
    scheduleKind: 'cron',
    scheduleValue: '0 9 * * *',
    payloadKind: 'agentTurn',
    payloadMessage: 'Aggregate overnight research, update docs',
    description: 'Aggregate overnight research, update docs',
  },
];

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
      return 'bg-amber-500 animate-pulse';
    default:
      return 'bg-zinc-500';
  }
}

function findAgent(agents: Agent[], agentId: string | undefined): Agent | undefined {
  if (!agentId) return undefined;
  return agents.find((a) => a.id === agentId);
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
            <th className="pr-3 pb-1 font-medium">Run ID</th>
            <th className="pr-3 pb-1 font-medium">Started</th>
            <th className="pr-3 pb-1 font-medium">Duration</th>
            <th className="pr-3 pb-1 font-medium">Status</th>
            <th className="pb-1 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.runId ?? run.sessionId ?? `${run.jobId}-${run.runAtMs ?? run.ts ?? 0}`}
              className="border-b border-zinc-800"
            >
              <td className="py-1.5 pr-3 font-mono text-zinc-400">
                {(run.runId ?? run.sessionId ?? '--').slice(0, 8)}
              </td>
              <td className="py-1.5 pr-3 text-zinc-400">
                {new Date(run.startedAtMs ?? run.runAtMs ?? run.ts ?? Date.now()).toLocaleString()}
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

// Validate a cron expression: 5 or 6 space-separated fields, each matching a valid cron token.
// Valid token pattern: numbers, ranges (1-5), steps (*/5, 1-5/2), lists (1,2,3), or wildcard (*).
function validateCronExpression(expr: string): string | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length < 5 || fields.length > 6) {
    return 'Cron expression must have 5 or 6 fields (e.g. "*/5 * * * *")';
  }
  const tokenPattern = /^(\*|\d+(-\d+)?(\/\d+)?)(,(\*|\d+(-\d+)?(\/\d+)?))*$|^\*\/\d+$/;
  for (const field of fields) {
    if (!tokenPattern.test(field)) {
      return `Invalid cron field: "${field}"`;
    }
  }
  return null;
}

function AddJobForm({
  onSubmit,
  onCancel,
  initialValues,
}: {
  onSubmit: (params: CronAddParams) => void;
  onCancel: () => void;
  initialValues?: Partial<CronTemplate>;
}) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [scheduleKind, setScheduleKind] = useState<'at' | 'every' | 'cron'>(
    initialValues?.scheduleKind ?? 'every'
  );
  const [scheduleValue, setScheduleValue] = useState(initialValues?.scheduleValue ?? '');
  const [timezone, setTimezone] = useState('');
  const [sessionTarget, setSessionTarget] = useState<'main' | 'isolated'>('main');
  const [wakeMode, setWakeMode] = useState<'next-heartbeat' | 'now'>('now');
  const [payloadKind, setPayloadKind] = useState<'systemEvent' | 'agentTurn'>(
    initialValues?.payloadKind ?? 'agentTurn'
  );
  const [payloadMessage, setPayloadMessage] = useState(initialValues?.payloadMessage ?? '');
  const [agentId, setAgentId] = useState(initialValues?.agentId ?? '');
  const [enabled, setEnabled] = useState(true);
  const [nameError, setNameError] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  // Sync initial values when template changes
  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name ?? '');
      setDescription(initialValues.description ?? '');
      setScheduleKind(initialValues.scheduleKind ?? 'every');
      setScheduleValue(initialValues.scheduleValue ?? '');
      setPayloadKind(initialValues.payloadKind ?? 'agentTurn');
      setPayloadMessage(initialValues.payloadMessage ?? '');
      setAgentId(initialValues.agentId ?? '');
      setNameError('');
      setScheduleError('');
    }
  }, [initialValues]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Validate required fields
      let valid = true;
      if (!name.trim()) {
        setNameError('Name is required');
        valid = false;
      } else {
        setNameError('');
      }

      if (!scheduleValue.trim()) {
        setScheduleError('Schedule value is required');
        valid = false;
      } else if (scheduleKind === 'cron') {
        const cronErr = validateCronExpression(scheduleValue);
        if (cronErr) {
          setScheduleError(cronErr);
          valid = false;
        } else {
          setScheduleError('');
        }
      } else {
        setScheduleError('');
      }

      if (!valid) return;

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
    [
      name,
      description,
      scheduleKind,
      scheduleValue,
      timezone,
      sessionTarget,
      wakeMode,
      payloadKind,
      payloadMessage,
      agentId,
      enabled,
      onSubmit,
    ]
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
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            className={`w-full rounded-md border bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500 ${nameError ? 'border-red-500' : 'border-zinc-700'}`}
            placeholder="My cron job"
          />
          {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
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
            {scheduleKind === 'cron'
              ? 'Cron Expression *'
              : scheduleKind === 'at'
                ? 'Date/Time *'
                : 'Interval *'}
          </label>
          <input
            type="text"
            value={scheduleValue}
            onChange={(e) => {
              setScheduleValue(e.target.value);
              if (scheduleError) setScheduleError('');
            }}
            className={`w-full rounded-md border bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500 ${scheduleError ? 'border-red-500' : 'border-zinc-700'}`}
            placeholder={
              scheduleKind === 'cron'
                ? '*/5 * * * *'
                : scheduleKind === 'at'
                  ? '2025-01-01T12:00:00Z'
                  : '30m'
            }
          />
          {scheduleError && <p className="mt-1 text-xs text-red-400">{scheduleError}</p>}
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

function JobRow({ job, agents }: { job: CronJob; agents: Agent[] }) {
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
      {/* Main Row */}
      <tr
        className="cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/50"
        onClick={handleExpand}
      >
        {/* Status Dot */}
        <td className="py-2.5 pr-2 pl-3">
          <div className={`h-2 w-2 rounded-full ${statusColor(job.state.lastStatus)}`} />
        </td>

        {/* Name + Demon */}
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
              job.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'
            }`}
            type="button"
          >
            {job.enabled ? 'On' : 'Off'}
          </button>
        </td>

        {/* Next Run */}
        <td className="py-2.5 pr-3 text-xs text-zinc-400">
          {job.state.runningAtMs ? (
            <span className="text-amber-400">Running...</span>
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

// ---- Quick Create Dropdown ------------------------------------------------

function QuickCreateDropdown({ onSelect }: { onSelect: (template: CronTemplate) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
        type="button"
      >
        Quick Create
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
            {CRON_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                }}
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-zinc-800"
                type="button"
              >
                <span className="text-sm text-zinc-100">{t.label}</span>
                <span className="text-xs text-zinc-500">{t.description}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Main Cron View -------------------------------------------------------

export function Cron() {
  const { jobs, isLoading, error, loadJobs } = useCronStore();
  const { agents, loadAgents } = useAgentsStore();
  const { status, request } = useConnectionStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [demonTasksOnly, setDemonTasksOnly] = useState(false);
  const [templateValues, setTemplateValues] = useState<Partial<CronTemplate> | undefined>(
    undefined
  );
  const [isRunningVerifiedCheck, setIsRunningVerifiedCheck] = useState(false);
  const [verifiedCheckEntries, setVerifiedCheckEntries] = useState<VerifiedCheckEntry[]>([]);

  const renderVerifiedOutput = useCallback((entry: VerifiedCheckEntry) => {
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
  }, []);

  // Load on mount
  useEffect(() => {
    if (status === 'connected') {
      loadJobs();
      loadAgents();
    }
  }, [status, loadJobs, loadAgents]);

  const handleAddJob = useCallback(async (params: CronAddParams) => {
    const { addJob } = useCronStore.getState();
    await addJob(params);
    setShowAddForm(false);
    setTemplateValues(undefined);
  }, []);

  const handleQuickCreate = useCallback((template: CronTemplate) => {
    setTemplateValues(template);
    setShowAddForm(true);
  }, []);

  const runVerifiedHealthCheck = useCallback(async () => {
    setIsRunningVerifiedCheck(true);
    setVerifiedCheckEntries([]);

    const entries: VerifiedCheckEntry[] = [];
    const runStep = async (command: string, method: string, params: unknown): Promise<boolean> => {
      try {
        const response = await request<unknown>(method, params);
        entries.push({
          command,
          output: JSON.stringify(response, null, 2),
        });
        setVerifiedCheckEntries([...entries]);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        entries.push({
          command,
          output: message,
          isError: true,
        });
        setVerifiedCheckEntries([...entries]);
        return false;
      }
    };

    const ok1 = await runStep(
      "/Users/admin/.nvm/versions/node/v24.13.1/bin/openclaw gateway call channels.status --json --params '{}'",
      'channels.status',
      {}
    );
    if (!ok1) {
      setIsRunningVerifiedCheck(false);
      return;
    }

    // Dynamically find a pulse/demon cron job from the loaded jobs list
    // instead of relying on a hardcoded UUID.
    const pulseJob = jobs.find((j) => {
      const tags = (j as CronJob & { tags?: string[] }).tags ?? [];
      if (tags.some((t) => t === 'demon-pulse' || t === 'demon_pulse' || t === 'pulse')) {
        return true;
      }
      if (j.payload?.kind === 'agentTurn' && Boolean(j.agentId)) {
        return true;
      }
      const name = (j.name ?? '').toLowerCase();
      return name.includes('pulse') || name.includes('demon');
    });

    if (!pulseJob) {
      entries.push({
        command: 'cron.run (pulse job lookup)',
        output:
          'No pulse/demon cron job found in the loaded job list. Load jobs first or create one.',
        isError: true,
      });
      setVerifiedCheckEntries([...entries]);
      setIsRunningVerifiedCheck(false);
      return;
    }

    const ok2 = await runStep(
      `/Users/admin/.nvm/versions/node/v24.13.1/bin/openclaw gateway call cron.run --json --params '{"id":"${pulseJob.id}"}'`,
      'cron.run',
      { id: pulseJob.id }
    );
    if (!ok2) {
      setIsRunningVerifiedCheck(false);
      return;
    }

    await runStep(
      `/Users/admin/.nvm/versions/node/v24.13.1/bin/openclaw gateway call cron.runs --json --params '{"id":"${pulseJob.id}","limit":10}'`,
      'cron.runs',
      { id: pulseJob.id, limit: 10 }
    );

    setIsRunningVerifiedCheck(false);
  }, [request, jobs]);

  const sortedJobs = useMemo(() => {
    let filtered = [...jobs];

    // Filter to demon tasks only
    if (demonTasksOnly) {
      filtered = filtered.filter((j) => j.agentId);
    }

    return filtered.sort((a, b) => {
      // Running jobs first, then by next run time
      if (a.state.runningAtMs && !b.state.runningAtMs) return -1;
      if (!a.state.runningAtMs && b.state.runningAtMs) return 1;
      const aNext = a.state.nextRunAtMs ?? Infinity;
      const bNext = b.state.nextRunAtMs ?? Infinity;
      return aNext - bNext;
    });
  }, [jobs, demonTasksOnly]);

  const enabledCount = jobs.filter((j) => j.enabled).length;
  const errorCount = jobs.filter((j) => j.state.lastStatus === 'error').length;
  const demonJobCount = jobs.filter((j) => j.agentId).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Cron & Automation</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            </span>
            <span>{enabledCount} enabled</span>
            <span>{demonJobCount} demon tasks</span>
            {errorCount > 0 && <span className="text-red-400">{errorCount} with errors</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Demon Tasks filter toggle */}
          <button
            onClick={() => setDemonTasksOnly(!demonTasksOnly)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              demonTasksOnly
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
            type="button"
          >
            Demon Tasks
          </button>

          <QuickCreateDropdown onSelect={handleQuickCreate} />

          <button
            onClick={() => loadJobs()}
            disabled={isLoading}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
            type="button"
          >
            Refresh
          </button>
          <button
            onClick={() => void runVerifiedHealthCheck()}
            disabled={status !== 'connected' || isRunningVerifiedCheck}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            type="button"
          >
            {isRunningVerifiedCheck ? 'Running Check...' : 'Verified Health Check'}
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (showAddForm) setTemplateValues(undefined);
            }}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            {showAddForm ? 'Cancel' : 'Add Job'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Verified health check output */}
        {verifiedCheckEntries.length > 0 && (
          <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Verified Health Check Output</h3>
              <button
                onClick={() => setVerifiedCheckEntries([])}
                className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                type="button"
              >
                Clear
              </button>
            </div>

            <div className="space-y-3">
              {verifiedCheckEntries.map((entry) => (
                <div
                  key={`${entry.command}-${entry.output.slice(0, 16)}`}
                  className={`rounded border p-2 ${
                    entry.isError
                      ? 'border-red-700 bg-red-950/20'
                      : 'border-zinc-700 bg-zinc-950/30'
                  }`}
                >
                  <div className="mb-1 text-xs text-zinc-400">{entry.command}</div>
                  {renderVerifiedOutput(entry)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Job Form */}
        {showAddForm && (
          <div className="mb-4">
            <AddJobForm
              onSubmit={handleAddJob}
              onCancel={() => {
                setShowAddForm(false);
                setTemplateValues(undefined);
              }}
              initialValues={templateValues}
            />
          </div>
        )}

        {error && jobs.length === 0 ? (
          <ErrorState message={error} onRetry={loadJobs} />
        ) : isLoading && jobs.length === 0 ? (
          <LoadingSpinner message="Loading cron jobs..." />
        ) : jobs.length === 0 ? (
          <EmptyState
            message="No cron jobs configured"
            detail='Click "Add Job" to create a scheduled automation.'
          />
        ) : sortedJobs.length === 0 && demonTasksOnly ? (
          <EmptyState
            message="No demon tasks found"
            detail='Use "Quick Create" to add common demon task templates.'
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-xs text-zinc-500">
                  <th className="w-8 pr-2 pb-2 pl-3 font-medium" />
                  <th className="pr-3 pb-2 font-medium">Name</th>
                  <th className="pr-3 pb-2 font-medium">Schedule</th>
                  <th className="pr-3 pb-2 font-medium">Enabled</th>
                  <th className="pr-3 pb-2 font-medium">Next Run</th>
                  <th className="pr-3 pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => (
                  <JobRow key={job.id} job={job} agents={agents} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
