// ---------------------------------------------------------------------------
// Demon Task Kanban View — Task Pipeline
// ---------------------------------------------------------------------------

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useDemonTasksStore, type DemonTask } from '@/stores/demonTasks';
import type { DemonConflict } from '@/lib/conflictDetection';
import { useDemonHealthStore } from '@/stores/demonHealth';
import { useConnectionStore } from '@/stores/connection';
import { EmptyState } from '@/components/StateIndicators';
import { StatusPill } from '@/components/atoms/StatusPill';
import { Card, CardContent } from '@/components/ui/card';
import { TaskCreateModal } from '@/components/organisms/TaskCreateModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    .replace('gpt-5-mini', 'gpt-5m');
}

// ---- FLIP Animation Hook --------------------------------------------------

/**
 * Returns a ref callback factory for task card elements.
 * Implements FLIP (First, Last, Invert, Play) animation when tasks move
 * between columns. Respects prefers-reduced-motion. Disabled during drag.
 */
function useFlipAnimation(
  tasks: DemonTask[],
  isDragging: MutableRefObject<boolean>
): (id: string) => (el: HTMLDivElement | null) => void {
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const elements = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevTaskIds = useRef<string[]>([]);

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  // First pass: snapshot positions BEFORE React commits new layout
  useLayoutEffect(() => {
    elements.current.forEach((el, id) => {
      prevRects.current.set(id, el.getBoundingClientRect());
    });
  });

  // Second pass: after React commits, measure new positions and animate
  useLayoutEffect(() => {
    if (prefersReducedMotion || isDragging.current) return;

    const currentIds = tasks.map((t) => t.id);
    const orderChanged =
      currentIds.length !== prevTaskIds.current.length ||
      currentIds.some((id, i) => id !== prevTaskIds.current[i]);

    if (!orderChanged) return;
    prevTaskIds.current = currentIds;

    elements.current.forEach((el, id) => {
      const prev = prevRects.current.get(id);
      if (!prev) return;

      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      // Invert: jump to old position instantly
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      // Play: animate to natural position on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 220ms ease-out';
          el.style.transform = '';
        });
      });
    });
  });

  return (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      elements.current.set(id, el);
    } else {
      elements.current.delete(id);
      prevRects.current.delete(id);
    }
  };
}

// ---- Conflict Detection UI ------------------------------------------------

function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: DemonConflict;
  onResolve: (id: string) => void;
}) {
  return (
    <div className="rounded-md border border-red-500/30 bg-zinc-800 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Type badge */}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              conflict.type === 'file'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {conflict.type}
          </span>
          {/* Resource name */}
          <span className="max-w-[200px] truncate font-mono text-xs text-zinc-200">
            {conflict.resource}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onResolve(conflict.id)}
          className="shrink-0 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
        >
          Resolve
        </button>
      </div>

      {/* Demons involved */}
      <div className="mb-2 flex flex-wrap gap-1">
        {conflict.demons.map((d) => (
          <span
            key={d.id}
            className="flex items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300"
          >
            <span>{d.emoji}</span>
            <span>{d.name}</span>
          </span>
        ))}
      </div>

      {/* Detected time */}
      <p className="text-[10px] text-zinc-500">Detected {relativeTime(conflict.detectedAt)}</p>
    </div>
  );
}

function ConflictsPanel({
  conflicts,
  onResolve,
}: {
  conflicts: DemonConflict[];
  onResolve: (id: string) => void;
}) {
  const unresolved = conflicts.filter((c) => !c.resolved);
  if (unresolved.length === 0) return null;

  return (
    <div className="mx-4 mb-4 rounded-md border border-red-500/40 bg-zinc-900 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        <span className="text-xs font-semibold tracking-wider text-red-400">
          CONFLICTS ({unresolved.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {unresolved.map((conflict) => (
          <ConflictCard key={conflict.id} conflict={conflict} onResolve={onResolve} />
        ))}
      </div>
    </div>
  );
}

// ---- Task Card Component --------------------------------------------------

function TaskCard({
  task,
  cardRef,
}: {
  task: DemonTask;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const isFailed = task.status === 'failed';
  const isDoneOld =
    task.status === 'done' && task.completedAt && Date.now() - task.completedAt > 60 * 60 * 1000;

  const borderClass = isFailed ? 'border-red-500/50' : 'border-zinc-700';
  const opacityClass = isDoneOld ? 'opacity-50' : '';

  return (
    <Card ref={cardRef} className={`bg-zinc-800 ${borderClass} ${opacityClass}`}>
      <CardContent className="p-3">
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
            <StatusPill status={task.status} className="text-[10px]" />
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
            {task.status === 'failed' &&
              task.startedAt &&
              elapsed(task.startedAt, task.completedAt)}
          </span>
        </div>

        {/* Delegation breadcrumbs */}
        {task.delegationChain.length > 0 && (
          <div className="mt-2 border-t border-zinc-700 pt-2">
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-zinc-500">
              {task.delegationChain.map((step, i) => (
                <span key={`${step.fromId}-${step.toId}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <span className="text-zinc-600">&rarr;</span>}
                  <span className="text-zinc-400">{step.fromName}</span>
                  <span className="text-zinc-600">&rarr;</span>
                  <span className="text-zinc-400">{step.toName}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Explicit task badge */}
        {task.isExplicit && (
          <div className="mt-1">
            <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-400">
              explicit
            </span>
          </div>
        )}

        {/* Error text for failed tasks */}
        {isFailed && task.error && (
          <div className="mt-2 border-t border-red-500/30 pt-2 text-xs text-red-400">
            {task.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Kanban Column --------------------------------------------------------

function KanbanColumn({
  title,
  count,
  tasks,
  getCardRef,
}: {
  title: string;
  count: number;
  tasks: DemonTask[];
  getCardRef: (id: string) => (el: HTMLDivElement | null) => void;
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
          tasks.map((task) => <TaskCard key={task.id} task={task} cardRef={getCardRef(task.id)} />)
        )}
      </div>
    </div>
  );
}

// ---- Main View ------------------------------------------------------------

export function DemonKanban() {
  const {
    tasks,
    conflicts,
    filterDemon,
    isTracking,
    startTracking,
    stopTracking,
    setFilter,
    getFilteredTasks,
    resolveConflict,
  } = useDemonTasksStore();
  const { demons } = useDemonHealthStore();
  const { status } = useConnectionStore();

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Track drag state to disable FLIP during drag operations
  const isDragging = useRef(false);

  // Start tracking on mount
  useEffect(() => {
    if (status === 'connected') {
      startTracking();
      // Start health monitoring if not already active (shared global store — other views may also use it)
      const { startMonitoring, isMonitoring } = useDemonHealthStore.getState();
      if (!isMonitoring) startMonitoring();
    }
    return () => {
      stopTracking();
      // Note: health monitoring is intentionally NOT stopped here — it's a shared global resource
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

  // FLIP animation — combine all tasks so the hook tracks order across columns
  const allTasks = useMemo(() => [...queued, ...inProgress, ...done], [queued, inProgress, done]);
  const getCardRef = useFlipAnimation(allTasks, isDragging);

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

          <div className="flex items-center gap-2">
            {/* Filter dropdown */}
            <Select
              value={filterDemon ?? '__all__'}
              onValueChange={(value) => setFilter(value === '__all__' ? null : value)}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Demons</SelectItem>
                {demons.map((d) => (
                  <SelectItem key={d.demonId} value={d.demonId}>
                    {d.demonEmoji} {d.demonName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setShowCreateModal(!showCreateModal)}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              {showCreateModal ? 'Cancel' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>

      {/* Conflict alerts */}
      <ConflictsPanel conflicts={conflicts} onResolve={resolveConflict} />

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {showCreateModal && <TaskCreateModal onClose={() => setShowCreateModal(false)} />}

        {!isTracking && tasks.length === 0 ? (
          <EmptyState
            message="No task activity yet"
            detail="Tasks appear here when demons delegate work to each other."
          />
        ) : (
          <div className="flex h-full gap-4 md:flex-row">
            <KanbanColumn
              title="QUEUED"
              count={queued.length}
              tasks={queued}
              getCardRef={getCardRef}
            />
            <KanbanColumn
              title="IN PROGRESS"
              count={inProgress.length}
              tasks={inProgress}
              getCardRef={getCardRef}
            />
            <KanbanColumn title="DONE" count={done.length} tasks={done} getCardRef={getCardRef} />
          </div>
        )}
      </div>
    </div>
  );
}
