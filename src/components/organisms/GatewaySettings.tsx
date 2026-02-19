import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { DEFAULT_GATEWAY_URL, useConnectionStore } from '@/stores/connection';

function isValidGatewayUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

export function GatewaySettings() {
  const { gatewayUrl, setGatewayUrl, connect, status } = useConnectionStore();
  const [value, setValue] = useState(gatewayUrl);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setValue(gatewayUrl);
  }, [gatewayUrl]);

  const handleApply = async (url: string) => {
    const trimmed = url.trim();
    if (!isValidGatewayUrl(trimmed)) {
      toast.error('Gateway URL must start with ws:// or wss://');
      return;
    }

    setIsApplying(true);
    try {
      setGatewayUrl(trimmed);
      await connect();
      toast.success('Gateway URL saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reconnect gateway';
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <h3 className="text-sm font-medium text-zinc-100">Gateway Connection</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Set the WebSocket URL used by the Fireplace gateway client.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={DEFAULT_GATEWAY_URL}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={() => handleApply(value)}
          disabled={isApplying}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {isApplying ? 'Applying...' : 'Save & Reconnect'}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(DEFAULT_GATEWAY_URL);
            void handleApply(DEFAULT_GATEWAY_URL);
          }}
          disabled={isApplying || gatewayUrl === DEFAULT_GATEWAY_URL}
          className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
        >
          Reset to Default
        </button>
      </div>

      <div className="mt-2 text-xs text-zinc-500">Current status: {status}</div>
    </div>
  );
}
