import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCronStore, type CronAddParams } from '@/stores/cron';
import { useConnectionStore } from '@/stores/connection';
import { useAgentsStore } from '@/stores/agents';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';
import { CronCreateModal, type CronTemplate } from '@/components/organisms/CronCreateModal';
import { CronJobCard } from '@/components/organisms/CronJobCard';
import { CronQuickCreateDropdown } from '@/components/molecules/CronQuickCreateDropdown';
import { CronVerifiedCheckPanel } from '@/components/organisms/CronVerifiedCheckPanel';
import type { GatewayMethod } from '@/gateway/types';

interface VerifiedCheckEntry {
  command: string;
  output: string;
  isError?: boolean;
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

export function Cron() {
  const { jobs, isLoading, error, loadJobs, addJob } = useCronStore();
  const { agents, loadAgents } = useAgentsStore();
  const { status, request } = useConnectionStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [demonTasksOnly, setDemonTasksOnly] = useState(false);
  const [templateValues, setTemplateValues] = useState<Partial<CronTemplate> | undefined>();
  const [isRunningVerifiedCheck, setIsRunningVerifiedCheck] = useState(false);
  const [verifiedCheckEntries, setVerifiedCheckEntries] = useState<VerifiedCheckEntry[]>([]);

  useEffect(() => {
    if (status === 'connected') {
      loadJobs();
      loadAgents();
    }
  }, [status, loadJobs, loadAgents]);

  const handleAddJob = useCallback(
    async (params: CronAddParams) => {
      await addJob(params);
      setShowAddForm(false);
      setTemplateValues(undefined);
    },
    [addJob]
  );

  const handleQuickCreate = useCallback((template: CronTemplate) => {
    setTemplateValues(template);
    setShowAddForm(true);
  }, []);

  const runVerifiedHealthCheck = useCallback(async () => {
    setIsRunningVerifiedCheck(true);
    setVerifiedCheckEntries([]);

    const entries: VerifiedCheckEntry[] = [];
    const runStep = async (
      command: string,
      method: GatewayMethod,
      params: unknown
    ): Promise<boolean> => {
      try {
        const response = await request<unknown>(method, params);
        entries.push({ command, output: JSON.stringify(response, null, 2) });
        setVerifiedCheckEntries([...entries]);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        entries.push({ command, output: message, isError: true });
        setVerifiedCheckEntries([...entries]);
        return false;
      }
    };

    const ok1 = await runStep(
      "openclaw gateway call channels.status --json --params '{}'",
      'channels.status',
      {}
    );
    if (!ok1) {
      setIsRunningVerifiedCheck(false);
      return;
    }

    const pulseJob = jobs.find((job) => {
      if (job.payload?.kind === 'agentTurn' && Boolean(job.agentId)) return true;
      const name = (job.name ?? '').toLowerCase();
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
      `openclaw gateway call cron.run --json --params '{"id":"${pulseJob.id}"}'`,
      'cron.run',
      { id: pulseJob.id }
    );
    if (!ok2) {
      setIsRunningVerifiedCheck(false);
      return;
    }

    await runStep(
      `openclaw gateway call cron.runs --json --params '{"id":"${pulseJob.id}","limit":10}'`,
      'cron.runs',
      { id: pulseJob.id, limit: 10 }
    );

    setIsRunningVerifiedCheck(false);
  }, [request, jobs]);

  const sortedJobs = useMemo(() => {
    let filtered = [...jobs];
    if (demonTasksOnly) {
      filtered = filtered.filter((job) => job.agentId);
    }

    return filtered.sort((a, b) => {
      if (a.state.runningAtMs && !b.state.runningAtMs) return -1;
      if (!a.state.runningAtMs && b.state.runningAtMs) return 1;
      const aNext = a.state.nextRunAtMs ?? Infinity;
      const bNext = b.state.nextRunAtMs ?? Infinity;
      return aNext - bNext;
    });
  }, [jobs, demonTasksOnly]);

  const enabledCount = jobs.filter((job) => job.enabled).length;
  const errorCount = jobs.filter((job) => job.state.lastStatus === 'error').length;
  const demonJobCount = jobs.filter((job) => job.agentId).length;

  return (
    <div className="flex h-full flex-col">
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

          <CronQuickCreateDropdown templates={CRON_TEMPLATES} onSelect={handleQuickCreate} />

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

      <div className="flex-1 overflow-y-auto p-3">
        <CronVerifiedCheckPanel
          entries={verifiedCheckEntries}
          onClear={() => setVerifiedCheckEntries([])}
        />

        {showAddForm && (
          <div className="mb-4">
            <CronCreateModal
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
                  <CronJobCard key={job.id} job={job} agents={agents} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
