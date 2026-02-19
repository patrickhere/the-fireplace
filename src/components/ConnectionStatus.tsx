import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/stores/connection';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusDot } from '@/components/atoms/StatusDot';

export function ConnectionStatus() {
  const {
    status,
    serverInfo,
    error,
    reconnectAttempt,
    gatewayUrl,
    setGatewayUrl,
    connect,
    disconnect,
  } = useConnectionStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(gatewayUrl);

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

  const config = statusConfig[status];
  const dotStatus =
    status === 'connected'
      ? 'online'
      : status === 'error'
        ? 'error'
        : status === 'disconnected'
          ? 'offline'
          : 'warning';
  const versionInfo = serverInfo
    ? `v${serverInfo.version} (protocol ${serverInfo.protocol})`
    : null;
  const errorMessage = error;

  const handleSaveUrl = () => {
    setGatewayUrl(editUrl);
    setIsEditing(false);
    if (status === 'disconnected') {
      connect();
    }
  };

  const handleConnect = () => {
    if (status === 'disconnected' || status === 'error') {
      connect();
    } else {
      disconnect();
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <div className="flex items-center gap-2">
        <StatusDot
          status={dotStatus}
          pulse={status === 'connecting' || status === 'reconnecting'}
        />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', config.textColor)}>{config.text}</p>
          {versionInfo && <p className="truncate text-xs text-zinc-500">{versionInfo}</p>}
          {errorMessage && <p className="truncate text-xs text-red-400">{errorMessage}</p>}
        </div>
        <Button
          size="sm"
          variant={status === 'connected' ? 'destructive' : 'default'}
          onClick={handleConnect}
          disabled={status === 'connecting' || status === 'authenticating'}
        >
          {status === 'connected' ? 'Disconnect' : 'Connect'}
        </Button>
      </div>

      {isEditing ? (
        <div className="flex gap-2">
          <Input
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="wss://your-gateway-url/"
            className="flex-1 text-sm"
          />
          <Button size="sm" onClick={handleSaveUrl}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-xs text-zinc-400">{gatewayUrl}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditUrl(gatewayUrl);
              setIsEditing(true);
            }}
            className="h-6 px-2 text-xs"
          >
            Change
          </Button>
        </div>
      )}
    </div>
  );
}
