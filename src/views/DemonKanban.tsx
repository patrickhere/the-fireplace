// ---------------------------------------------------------------------------
// Demon Task Kanban View — Task Pipeline
// ---------------------------------------------------------------------------

import { useEffect, useMemo } from 'react';
import { useDemonTasksStore } from '@/stores/demonTasks';
import { useDemonHealthStore } from '@/stores/demonHealth';
import { useConnectionStore } from '@/stores/connection';
import type { DemonTask } from '@/stores/demonTasks';

// ---- Helpers --------------------------------------------------------------

function relativeTime(timestamp: number): string {
  if (!timestamp) return '—';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function elapsed(from: number, to?: number | null): string {
  const end = to ?? Date.now();
  const seconds = Math.floor((end - from) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function shortModel(model: string): string {
  if (!model) return '';
  const parts = model.split('/');
  const name = parts[parts.length - 1] ?? model;
  return name
    .replace('claude-opus-4-6', 'opus-4.6')
    .replace('claude-sonnet-4-5', 'sonnet-4.5')
    .replace('claude-haiku-4-5', 'haiku-4.5')
    .replace('gemini-2.5-flash', 'flash-2.5')
    .replace('gpt-4.1', 'gpt-4.1')
    .replace('gpt-5-mini', 'gpt-5m')
    .replace('gpt-4o', 'gpt-4o');
}

// ---- Task Card Component --------------------------------------------------

function TaskCard({ task }: { task: DemonTask }) {
  const isFailed = task.status === 'failed';
  const isDoneOld =
    task.status === 'done' && task.completedAt && Date.now() - task.completedAt > 60 * 60 * 1000;

  const borderClass = isFailed ? 'border-red-500/50' : 'border-zinc-700';
  const opacityClass = isDoneOld ? 'opacity-50' : '';

  return (
    <div className={`rounded-lg border bg-zinc-800 p-3 ${borderClass} ${opacityClass}`}>
      {/* Description */}
      <p className="mb-2 line-clamp-2 text-sm text-zinc-200">{task.description}</p>

      {/* Assigned demon */}
      <div className="mb-1 flex items-center gap-1 text-xs text-zinc-400">
        <span>&rarr;</span>
        <span>{task.assignedToEmoji}</span>
        <span>{task.assignedToName}</span>
      </div>

      {/* Delegated by */}
      <div className="mb-2 flex items-center gap-1 text-xs text-zinc-500">
        <span>by</span>
        <span>{task.delegatedByEmoji}</span>
        <span>{task.delegatedByName}</span>
      </div>

      {/* Bottom row: model, time, CLI backend */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          {task.model && (
            <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-300">
              {shortModel(task.model)}
            </span>
          )}
          {task.cliBackend && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              {task.cliBackend === 'claude-code' ? 'Claude Code' : 'Codex'}
            </span>
          )}
        </div>
        <span>
          {task.status === 'queued' && relativeTime(task.createdAt)}
          {task.status === 'in_progress' && task.startedAt && elapsed(task.startedAt)}
          {task.status === 'done' && task.startedAt && elapsed(task.startedAt, task.completedAt)}
          {task.status === 'failed' && task.startedAt && elapsed(task.startedAt, task.completedAt)}
        </span>
      </div>

      {/* Error text for failed tasks */}
      {isFailed && task.error && (
        <div className="mt-2 border-t border-red-500/30 pt-2 text-xs text-red-400">
          {task.error}
        </div>
      )}
    </div>
  );
}

// ---- Kanban Column --------------------------------------------------------

function KanbanColumn({
  title,
  count,
  tasks,
}: {
  title: string;
  count: number;
  tasks: DemonTask[];
}) {
  return (
    <div className="flex min-w-[280px] flex-1 flex-col">
      {/* Column header */}
      <div className="mb-3 border-b border-zinc-700 pb-2">
        <span className="text-xs font-semibold tracking-wider text-zinc-400">
          {title} ({count})
        </span>
      </div>

      {/* Column body */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-xs text-zinc-600">No tasks</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

// ---- Main View ------------------------------------------------------------

export function DemonKanban() {
  const {
    tasks,
    filterDemon,
    isTracking,
    startTracking,
    stopTracking,
    setFilter,
    getFilteredTasks,
  } = useDemonTasksStore();
  const { demons } = useDemonHealthStore();
  const { status } = useConnectionStore();

  // Start tracking on mount
  useEffect(() => {
    if (status === 'connected') {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [status, startTracking, stopTracking]);

  // Get filtered tasks and group by status
  const filteredTasks = useMemo(() => getFilteredTasks(), [tasks, filterDemon, getFilteredTasks]);

  const queued = useMemo(() => filteredTasks.filter((t) => t.status === 'queued'), [filteredTasks]);

  const inProgress = useMemo(
    () => filteredTasks.filter((t) => t.status === 'in_progress'),
    [filteredTasks]
  );

  const done = useMemo(
    () =>
      filteredTasks
        .filter((t) => t.status === 'done' || t.status === 'failed')
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [filteredTasks]
  );

  // Summary
  const summaryParts: string[] = [];
  if (queued.length) summaryParts.push(`${queued.length} queued`);
  if (inProgress.length) summaryParts.push(`${inProgress.length} in progress`);
  if (done.length) summaryParts.push(`${done.length} done`);
  const summary = summaryParts.join(' · ') || 'No tasks';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Task Pipeline</h1>
            <p className="text-sm text-zinc-400">{summary}</p>
          </div>

          {/* Filter dropdown */}
          <select
            value={filterDemon ?? ''}
            onChange={(e) => setFilter(e.target.value || null)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:border-amber-500 focus:outline-none"
          >
            <option value="">All Demons</option>
            {demons.map((d) => (
              <option key={d.demonId} value={d.demonId}>
                {d.demonEmoji} {d.demonName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {!isTracking && tasks.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Waiting for demon task activity. Tasks appear when demons delegate work to each other.
          </p>
        ) : (
          <div className="flex h-full gap-4 md:flex-row">
            <KanbanColumn title="QUEUED" count={queued.length} tasks={queued} />
            <KanbanColumn title="IN PROGRESS" count={inProgress.length} tasks={inProgress} />
            <KanbanColumn title="DONE" count={done.length} tasks={done} />
          </div>
        )}
      </div>
    </div>
  );
}
