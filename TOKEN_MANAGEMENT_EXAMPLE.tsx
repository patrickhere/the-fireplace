// ---------------------------------------------------------------------------
// Example: Token Management UI Component
// ---------------------------------------------------------------------------
//
// This is an example component showing how to integrate device token
// management into The Fireplace UI. This can be added to the More/Settings
// view to give users control over their stored tokens.

import { useState } from 'react';
import { useConnectionStore } from '@/stores/connection';
import { hasDeviceToken, deleteDeviceToken } from '@/lib/keychain';
import { getOrCreateDeviceId } from '@/gateway/protocol';

export function TokenManagement() {
  const { gatewayUrl, auth, status } = useConnectionStore();
  const [tokenExists, setTokenExists] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Check if a token exists for the current gateway
  const checkToken = async () => {
    setIsChecking(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const exists = await hasDeviceToken(deviceId, gatewayUrl);
      setTokenExists(exists);
    } catch (err) {
      console.error('Failed to check token:', err);
      setTokenExists(null);
    } finally {
      setIsChecking(false);
    }
  };

  // Clear the stored token for the current gateway
  const clearToken = async () => {
    if (!confirm('Clear stored device token? You will need to re-approve this device next time.')) {
      return;
    }

    setIsClearing(true);
    try {
      const deviceId = getOrCreateDeviceId();
      await deleteDeviceToken(deviceId, gatewayUrl);
      setTokenExists(false);
      alert('Device token cleared successfully.');
    } catch (err) {
      console.error('Failed to clear token:', err);
      alert(`Failed to clear token: ${err}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Device Token</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Device tokens are stored securely in your system keychain and allow automatic
          re-authentication without requiring device approval.
        </p>
      </div>

      {/* Current Token Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Current Gateway:</span>
          <code className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{gatewayUrl}</code>
        </div>

        {status === 'connected' && auth && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Token Status:</span>
              <span className="rounded bg-emerald-900/30 px-2 py-1 text-xs text-emerald-400">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Role:</span>
              <span className="text-xs text-zinc-300">{auth.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Scopes:</span>
              <span className="text-xs text-zinc-300">{auth.scopes.join(', ')}</span>
            </div>
            {auth.issuedAtMs && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Issued:</span>
                <span className="text-xs text-zinc-300">
                  {new Date(auth.issuedAtMs).toLocaleString()}
                </span>
              </div>
            )}
          </>
        )}

        {tokenExists !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Keychain:</span>
            <span
              className={`rounded px-2 py-1 text-xs ${
                tokenExists ? 'bg-emerald-900/30 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {tokenExists ? 'Token Stored' : 'No Token'}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={checkToken}
          disabled={isChecking}
          className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          {isChecking ? 'Checking...' : 'Check Keychain'}
        </button>

        <button
          onClick={clearToken}
          disabled={isClearing || tokenExists === false}
          className="rounded bg-red-900/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 disabled:opacity-50"
        >
          {isClearing ? 'Clearing...' : 'Clear Token'}
        </button>
      </div>

      {/* Info Box */}
      <div className="rounded border border-amber-900/30 bg-amber-900/10 p-3">
        <p className="text-xs text-amber-400">
          <strong>Note:</strong> Clearing your device token will require you to re-approve this
          device the next time you connect. Your device token is stored locally in your system
          keychain and is never sent to third parties.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration Example
// ---------------------------------------------------------------------------
//
// Add this component to the More view (src/views/More.tsx):
//
// import { TokenManagement } from '@/components/TokenManagement';
//
// export function More() {
//   return (
//     <div className="space-y-4 p-4">
//       {/* ... other settings ... */}
//       <TokenManagement />
//     </div>
//   );
// }
