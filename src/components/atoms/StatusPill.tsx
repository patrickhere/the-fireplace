import { Badge, type BadgeProps } from '@/components/ui/badge';

const SUCCESS = new Set(['connected', 'online', 'healthy', 'active']);
const DANGER = new Set(['error', 'failed', 'dead']);
const WARNING = new Set(['warning', 'degraded', 'busy']);
const DEFAULT = new Set(['idle', 'offline', 'unknown']);

function toTitle(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`)
    .join(' ');
}

function statusVariant(status: string): NonNullable<BadgeProps['variant']> {
  const normalized = status.trim().toLowerCase();
  if (SUCCESS.has(normalized)) return 'success';
  if (DANGER.has(normalized)) return 'danger';
  if (WARNING.has(normalized)) return 'warning';
  if (DEFAULT.has(normalized)) return 'default';
  return 'default';
}

export interface StatusPillProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  return (
    <Badge variant={statusVariant(status)} className={className}>
      {label ?? toTitle(status)}
    </Badge>
  );
}
