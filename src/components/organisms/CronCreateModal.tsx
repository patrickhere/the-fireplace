import { useCallback, useEffect, useState } from 'react';
import type { CronAddParams, CronPayload, CronSchedule } from '@/stores/cron';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface CronTemplate {
  label: string;
  name: string;
  agentId: string;
  scheduleKind: 'at' | 'every' | 'cron';
  scheduleValue: string;
  payloadKind: 'systemEvent' | 'agentTurn';
  payloadMessage: string;
  description: string;
}

interface CronFieldSpec {
  name: string;
  min: number;
  max: number;
  aliases?: Record<string, number>;
}

const CRON_FIELDS: [CronFieldSpec, CronFieldSpec, CronFieldSpec, CronFieldSpec, CronFieldSpec] = [
  { name: 'Minute', min: 0, max: 59 },
  { name: 'Hour', min: 0, max: 23 },
  { name: 'Day-of-month', min: 1, max: 31 },
  {
    name: 'Month',
    min: 1,
    max: 12,
    aliases: {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    },
  },
  {
    name: 'Day-of-week',
    min: 0,
    max: 7,
    aliases: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 },
  },
];

function parseDurationToMs(input: string): number {
  const trimmed = input.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/.exec(trimmed);
  if (!match) return 0;
  const value = parseFloat(match[1] ?? '0');
  const unit = match[2] ?? 'ms';
  switch (unit) {
    case 'ms':
      return Math.round(value);
    case 's':
      return Math.round(value * 1_000);
    case 'm':
      return Math.round(value * 60_000);
    case 'h':
      return Math.round(value * 3_600_000);
    case 'd':
      return Math.round(value * 86_400_000);
    default:
      return Math.round(value);
  }
}

function resolveValue(token: string, spec: CronFieldSpec): number | null {
  const lower = token.toLowerCase();
  if (spec.aliases && Object.prototype.hasOwnProperty.call(spec.aliases, lower)) {
    return spec.aliases[lower] ?? null;
  }
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return null;
}

interface CronValidationResult {
  error?: string;
  warning?: string;
}

function validateCronToken(token: string, spec: CronFieldSpec): CronValidationResult {
  if (token === '*') return {};

  const stepWildcardMatch = /^\*\/(\d+)$/.exec(token);
  if (stepWildcardMatch) {
    const stepStr = stepWildcardMatch[1];
    if (stepStr === undefined)
      return { error: `${spec.name}: malformed step expression "${token}"` };
    const step = parseInt(stepStr, 10);
    if (step === 0) return { error: `${spec.name}: step value cannot be zero` };
    if (step > spec.max - spec.min) {
      return {
        warning: `${spec.name}: step ${step.toString()} exceeds field range (${spec.min.toString()}-${spec.max.toString()})`,
      };
    }
    return {};
  }

  const parts = token.split(',');
  for (const part of parts) {
    const rangeStepMatch = /^([^/]+)(?:\/(\d+))?$/.exec(part);
    if (!rangeStepMatch) return { error: `${spec.name}: malformed token "${part}"` };

    const rangePart = rangeStepMatch[1];
    const stepStr = rangeStepMatch[2];

    if (rangePart === undefined) return { error: `${spec.name}: malformed token "${part}"` };

    if (rangePart.includes('-')) {
      const dashParts = rangePart.split('-');
      if (dashParts.length !== 2) return { error: `${spec.name}: malformed range "${rangePart}"` };
      const startStr = dashParts[0] ?? '';
      const endStr = dashParts[1] ?? '';

      const start = resolveValue(startStr, spec);
      const end = resolveValue(endStr, spec);

      if (start === null)
        return { error: `${spec.name}: unrecognised value "${startStr}" in range "${rangePart}"` };
      if (end === null)
        return { error: `${spec.name}: unrecognised value "${endStr}" in range "${rangePart}"` };
      if (start < spec.min || start > spec.max)
        return {
          error: `${spec.name}: value ${start.toString()} is out of range (${spec.min.toString()}-${spec.max.toString()})`,
        };
      if (end < spec.min || end > spec.max)
        return {
          error: `${spec.name}: value ${end.toString()} is out of range (${spec.min.toString()}-${spec.max.toString()})`,
        };
      if (start > end)
        return {
          error: `${spec.name}: range start ${start.toString()} is greater than end ${end.toString()}`,
        };

      if (stepStr !== undefined) {
        const step = parseInt(stepStr, 10);
        if (step === 0) return { error: `${spec.name}: step value cannot be zero` };
        if (step > end - start) {
          return {
            warning: `${spec.name}: step ${step.toString()} exceeds range ${start.toString()}-${end.toString()}`,
          };
        }
      }
    } else {
      const val = resolveValue(rangePart, spec);
      if (val === null) return { error: `${spec.name}: unrecognised value "${rangePart}"` };
      if (val < spec.min || val > spec.max)
        return {
          error: `${spec.name}: value ${val.toString()} is out of range (${spec.min.toString()}-${spec.max.toString()})`,
        };

      if (stepStr !== undefined) {
        const step = parseInt(stepStr, 10);
        if (step === 0) return { error: `${spec.name}: step value cannot be zero` };
      }
    }
  }

  return {};
}

function validateCronExpression(expr: string): CronValidationResult {
  const trimmed = expr.trim();
  if (!trimmed) return { error: 'Cron expression cannot be empty' };

  const fields = trimmed.split(/\s+/);
  if (fields.length < 5 || fields.length > 7) {
    return {
      error: `Expected 5-7 fields (got ${fields.length.toString()}): minute hour day-of-month month day-of-week [seconds] [year]`,
    };
  }

  const warnings: string[] = [];
  if (fields.length > 5) {
    warnings.push(
      `${fields.length.toString()}-field expression — extra fields will be sent as-is to the backend`
    );
  }

  for (let i = 0; i < 5; i++) {
    const field = fields[i];
    const spec = CRON_FIELDS[i];
    if (field === undefined || spec === undefined) continue;
    const result = validateCronToken(field, spec);
    if (result.error) return { error: result.error };
    if (result.warning) warnings.push(result.warning);
  }

  return warnings.length > 0 ? { warning: warnings.join('; ') } : {};
}

export function CronCreateModal({
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
  const [scheduleWarning, setScheduleWarning] = useState('');

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
      setScheduleWarning('');
    }
  }, [initialValues]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

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
      } else if (scheduleKind === 'every') {
        const ms = parseDurationToMs(scheduleValue.trim());
        if (ms <= 0) {
          setScheduleError('Invalid interval — use e.g. 30s, 5m, 2h, 1d');
          valid = false;
        } else {
          setScheduleError('');
          setScheduleWarning('');
        }
      } else if (scheduleKind === 'cron') {
        const cronResult = validateCronExpression(scheduleValue);
        if (cronResult.error) {
          setScheduleError(cronResult.error);
          valid = false;
        } else {
          setScheduleError('');
          setScheduleWarning('');
        }
      } else {
        setScheduleError('');
        setScheduleWarning('');
      }

      if (!valid) return;

      const trimmedValue = scheduleValue.trim();
      const trimmedTz = timezone.trim() || undefined;
      let schedule: CronSchedule;
      if (scheduleKind === 'at') {
        schedule = { kind: 'at', at: trimmedValue };
      } else if (scheduleKind === 'every') {
        schedule = { kind: 'every', everyMs: parseDurationToMs(trimmedValue) };
      } else {
        schedule = { kind: 'cron', expr: trimmedValue, ...(trimmedTz ? { tz: trimmedTz } : {}) };
      }

      const trimmedMsg = payloadMessage.trim();
      let payload: CronPayload;
      if (payloadKind === 'systemEvent') {
        payload = { kind: 'systemEvent', text: trimmedMsg || '' };
      } else {
        payload = { kind: 'agentTurn', message: trimmedMsg || '' };
      }

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
          <Select
            value={scheduleKind}
            onValueChange={(value) => setScheduleKind(value as 'at' | 'every' | 'cron')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="every">Every (interval)</SelectItem>
              <SelectItem value="cron">Cron expression</SelectItem>
              <SelectItem value="at">At (one-time)</SelectItem>
            </SelectContent>
          </Select>
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
              const val = e.target.value;
              setScheduleValue(val);
              if (scheduleKind === 'cron') {
                if (val.trim().length > 0) {
                  const result = validateCronExpression(val);
                  setScheduleError(result.error ?? '');
                  setScheduleWarning(result.warning ?? '');
                } else {
                  setScheduleError('');
                  setScheduleWarning('');
                }
              } else if (scheduleError) {
                setScheduleError('');
                setScheduleWarning('');
              }
            }}
            className={`w-full rounded-md border bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500 ${scheduleError ? 'border-red-500' : scheduleWarning ? 'border-amber-600' : scheduleKind === 'cron' && scheduleValue.trim() && !validateCronExpression(scheduleValue).error ? 'border-emerald-600' : 'border-zinc-700'}`}
            placeholder={
              scheduleKind === 'cron'
                ? '*/5 * * * *'
                : scheduleKind === 'at'
                  ? '2025-01-01T12:00:00Z'
                  : '30m'
            }
          />
          {scheduleKind === 'cron' && (
            <p className="mt-1 text-xs text-zinc-600">
              Standard: minute hour day-of-month month day-of-week (5+ fields accepted)
            </p>
          )}
          {scheduleError && <p className="mt-1 text-xs text-red-400">{scheduleError}</p>}
          {scheduleWarning && !scheduleError && (
            <p className="mt-1 text-xs text-amber-400">{scheduleWarning}</p>
          )}
          {scheduleKind === 'cron' &&
            scheduleValue.trim() &&
            !validateCronExpression(scheduleValue).error &&
            !scheduleError &&
            !scheduleWarning && (
              <p className="mt-1 text-xs text-emerald-500">Valid cron expression</p>
            )}
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
          <Select
            value={sessionTarget}
            onValueChange={(value) => setSessionTarget(value as 'main' | 'isolated')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main session</SelectItem>
              <SelectItem value="isolated">Isolated session</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Wake Mode</label>
          <Select
            value={wakeMode}
            onValueChange={(value) => setWakeMode(value as 'next-heartbeat' | 'now')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="now">Immediately</SelectItem>
              <SelectItem value="next-heartbeat">Next heartbeat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Payload Type</label>
          <Select
            value={payloadKind}
            onValueChange={(value) => setPayloadKind(value as 'systemEvent' | 'agentTurn')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agentTurn">Agent Turn</SelectItem>
              <SelectItem value="systemEvent">System Event</SelectItem>
            </SelectContent>
          </Select>
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
