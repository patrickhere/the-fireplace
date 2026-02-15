import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/stores/connection';

export function ConnectionStatus() {
  const { state, serverInfo, error, reconnectAttempt } = useConnectionStore();

  const statusConfig = {
    connected: {
      color: 'bg-emerald-500',
      text: 'Connected',
      textColor: 'text-emerald-500',
    },
    connecting: {
      color: 'bg-amber-500',
      text: 'Connecting...',
      textColor: 'text-amber-500',
    },
    challenged: {
      color: 'bg-amber-500',
      text: 'Authenticating...',
      textColor: 'text-amber-500',
    },
    authenticating: {
      color: 'bg-amber-500',
      text: 'Authenticating...',
      textColor: 'text-amber-500',
    },
    reconnecting: {
      color: 'bg-amber-500',
      text: `Reconnecting (${reconnectAttempt})...`,
      textColor: 'text-amber-500',
    },
    disconnected: {
      color: 'bg-zinc-500',
      text: 'Disconnected',
      textColor: 'text-zinc-500',
    },
    error: {
      color: 'bg-red-500',
      text: 'Error',
      textColor: 'text-red-500',
    },
  };

  const config = statusConfig[state];
  const versionInfo = serverInfo
    ? `v${serverInfo.version} (protocol ${serverInfo.protocol})`
    : null;
  const errorMessage = error;

  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', config.color)} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', config.textColor)}>{config.text}</p>
        {versionInfo && <p className="truncate text-xs text-zinc-500">{versionInfo}</p>}
        {errorMessage && <p className="truncate text-xs text-red-400">{errorMessage}</p>}
      </div>
    </div>
  );
}
