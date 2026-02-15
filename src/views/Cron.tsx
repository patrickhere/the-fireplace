// ---------------------------------------------------------------------------
// Cron View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useCronStore } from '@/stores/cron';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import type { CronJob, CronExecution } from '@/stores/cron';

// ---- Create Job Modal -----------------------------------------------------

function CreateJobModal() {
  const { showCreateModal, setShowCreateModal, createJob } = useCronStore();
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [command, setCommand] = useState('');
  const [enabled, setEnabled] = useState(true);

  if (!showCreateModal) return null;

  const handleCreate = async () => {
    if (!name.trim() || !schedule.trim() || !command.trim()) return;
    await createJob(name, schedule, command, enabled);
    setName('');
    setSchedule('');
    setCommand('');
    setEnabled(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Create Cron Job</h2>
          <button
            onClick={() => setShowCreateModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3 p-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs text-zinc-400">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
              placeholder="My backup job"
            />
          </div>

          <div>
            <label htmlFor="schedule" className="mb-1 block text-xs text-zinc-400">
              Schedule (cron expression)
            </label>
            <input
              id="schedule"
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
              placeholder="0 2 * * *"
            />
            <p className="mt-1 text-xs text-zinc-500">e.g., "0 2 * * *" = daily at 2am</p>
          </div>

          <div>
            <label htmlFor="command" className="mb-1 block text-xs text-zinc-400">
              Command
            </label>
            <textarea
              id="command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
              placeholder="echo 'Hello, world!'"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/30"
            />
            <label htmlFor="enabled" className="text-sm text-zinc-400">
              Enable immediately
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-zinc-700 p-4">
          <button
            onClick={() => setShowCreateModal(false)}
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            Create Job
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- History Modal --------------------------------------------------------

function HistoryModal() {
  const { executions, showHistoryModal, setShowHistoryModal } = useCronStore();

  if (!showHistoryModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Execution History</h2>
          <button
            onClick={() => setShowHistoryModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Executions */}
        <div className="space-y-2 overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {executions.length === 0 ? (
            <p className="text-sm text-zinc-400">No execution history yet.</p>
          ) : (
            executions.map((exec) => <ExecutionItem key={exec.id} execution={exec} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ExecutionItem({ execution }: { execution: CronExecution }) {
  const statusColor =
    execution.status === 'success'
      ? 'text-emerald-400'
      : execution.status === 'failed'
        ? 'text-red-400'
        : 'text-amber-400';

  const duration = execution.completedAt
    ? execution.completedAt - execution.startedAt
    : Date.now() - execution.startedAt;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-100">{execution.jobName}</span>
        <span className={`text-xs font-semibold ${statusColor}`}>{execution.status}</span>
      </div>
      <div className="flex justify-between text-xs text-zinc-400">
        <span>Started: {new Date(execution.startedAt).toLocaleString()}</span>
        <span>Duration: {(duration / 1000).toFixed(2)}s</span>
      </div>
      {execution.error && (
        <div className="mt-2 rounded bg-red-500/10 p-2 font-mono text-xs text-red-400">
          {execution.error}
        </div>
      )}
      {execution.output && (
        <div className="mt-2 max-h-24 overflow-y-auto rounded bg-zinc-900 p-2 font-mono text-xs text-zinc-300">
          {execution.output}
        </div>
      )}
    </div>
  );
}

// ---- Job Row (Desktop) ----------------------------------------------------

function JobRow({ job }: { job: CronJob }) {
  const { enableJob, disableJob, runJob, deleteJob, updateJob } = useCronStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSchedule, setEditSchedule] = useState(job.schedule);

  const handleSaveSchedule = async () => {
    await updateJob(job.id, { schedule: editSchedule });
    setIsEditing(false);
  };

  return (
    <>
      <tr className="border-b border-zinc-700 hover:bg-zinc-800/50">
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${job.enabled ? 'bg-emerald-500' : 'bg-zinc-500'}`}
            />
            <span className="text-sm font-medium text-zinc-100">{job.name}</span>
          </div>
        </td>
        <td className="p-3">
          {isEditing ? (
            <input
              type="text"
              value={editSchedule}
              onChange={(e) => setEditSchedule(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100"
              onBlur={handleSaveSchedule}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSchedule()}
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="font-mono text-sm text-zinc-400 hover:text-zinc-100"
              type="button"
            >
              {job.schedule}
            </button>
          )}
        </td>
        <td className="p-3 font-mono text-xs text-zinc-400">{job.command}</td>
        <td className="p-3 text-xs text-zinc-400">
          {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
        </td>
        <td className="p-3 text-xs text-zinc-400">
          {job.nextRun ? new Date(job.nextRun).toLocaleString() : 'N/A'}
        </td>
        <td className="p-3">
          <div className="flex gap-1">
            <button
              onClick={() => (job.enabled ? disableJob(job.id) : enableJob(job.id))}
              className={`rounded px-2 py-1 text-xs ${
                job.enabled
                  ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
              type="button"
            >
              {job.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() => runJob(job.id)}
              className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/30"
              type="button"
            >
              Run
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
              type="button"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {showDeleteConfirm && (
        <tr>
          <td colSpan={6} className="bg-red-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400">Delete job "{job.name}"?</span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await deleteJob(job.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="rounded-md bg-red-500 px-3 py-1 text-xs text-zinc-950 hover:bg-red-400"
                  type="button"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---- Job Card (Mobile) ----------------------------------------------------

function JobCard({ job }: { job: CronJob }) {
  const { enableJob, disableJob, runJob, deleteJob } = useCronStore();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${job.enabled ? 'bg-emerald-500' : 'bg-zinc-500'}`}
          />
          <h3 className="text-sm font-semibold text-zinc-100">{job.name}</h3>
        </div>
        <button
          onClick={() => setShowActions(!showActions)}
          className="text-zinc-400 hover:text-zinc-100"
          type="button"
        >
          •••
        </button>
      </div>

      <div className="space-y-1 text-xs">
        <div className="text-zinc-400">
          Schedule: <span className="font-mono text-zinc-300">{job.schedule}</span>
        </div>
        <div className="text-zinc-400">
          Command: <span className="font-mono text-zinc-300">{job.command}</span>
        </div>
        <div className="text-zinc-400">
          Last run: {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
        </div>
      </div>

      {showActions && !showDeleteConfirm && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => (job.enabled ? disableJob(job.id) : enableJob(job.id))}
            className={`rounded px-3 py-1 text-xs ${
              job.enabled ? 'bg-zinc-700 text-zinc-300' : 'bg-emerald-500/20 text-emerald-400'
            }`}
            type="button"
          >
            {job.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => runJob(job.id)}
            className="rounded bg-amber-500/20 px-3 py-1 text-xs text-amber-400"
            type="button"
          >
            Run Now
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded bg-red-500/10 px-3 py-1 text-xs text-red-400"
            type="button"
          >
            Delete
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="mt-3 rounded bg-red-500/5 p-2">
          <p className="mb-2 text-xs text-red-400">Delete this job?</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await deleteJob(job.id);
                setShowDeleteConfirm(false);
              }}
              className="flex-1 rounded bg-red-500 px-3 py-1 text-xs text-zinc-950"
              type="button"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Cron View -------------------------------------------------------

export function Cron() {
  const {
    jobs,
    isLoading,
    error,
    loadJobs,
    setShowCreateModal,
    setShowHistoryModal,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useCronStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (status === 'connected') {
      loadJobs();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadJobs, subscribeToEvents, unsubscribeFromEvents]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Cron</h1>
        <p className="text-sm text-zinc-400">Scheduled jobs and automation</p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            Create Job
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            View History
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-sm text-zinc-400">Loading cron jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-zinc-400">No cron jobs yet. Create one to get started.</div>
        ) : isMobile ? (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Name</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Schedule</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Command</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Last Run</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Next Run</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <CreateJobModal />
      <HistoryModal />
    </div>
  );
}
