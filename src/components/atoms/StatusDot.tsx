import { cn } from '@/lib/utils';

type DotStatus = 'online' | 'busy' | 'warning' | 'error' | 'offline';
type DotSize = 'sm' | 'md';

const STATUS_CLASS: Record<DotStatus, string> = {
  online: 'bg-emerald-500',
  busy: 'bg-amber-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  offline: 'bg-zinc-500',
};

const SIZE_CLASS: Record<DotSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
};

export interface StatusDotProps {
  status: DotStatus;
  size?: DotSize;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ status, size = 'sm', pulse = false, className }: StatusDotProps) {
  return (
    <span
      aria-hidden
      data-status={status}
      className={cn(
        'inline-block rounded-full',
        SIZE_CLASS[size],
        STATUS_CLASS[status],
        pulse && 'animate-pulse',
        className
      )}
    />
  );
}
