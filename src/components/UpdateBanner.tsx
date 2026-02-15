// ---------------------------------------------------------------------------
// Update Banner
// ---------------------------------------------------------------------------
// Shows a subtle banner when a new version is available for download.
// Only visible on macOS (iOS updates go through the App Store).

import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { usePlatform } from '@/hooks/usePlatform';

export function UpdateBanner() {
  const platform = usePlatform();
  const { available, version, downloading, ready, installUpdate } = useAutoUpdate();

  // Only show on macOS
  if (platform !== 'macos') return null;

  // Nothing to show
  if (!available && !ready) return null;

  if (ready) {
    return (
      <div className="flex items-center justify-between border-b border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
        <span className="text-xs text-emerald-400">Update installed. Restart to apply.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
      <span className="text-xs text-amber-400">
        {downloading ? 'Downloading update...' : `Version ${version ?? 'unknown'} is available`}
      </span>
      {!downloading && (
        <button
          onClick={() => installUpdate()}
          className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-medium text-zinc-950 hover:bg-amber-400"
          type="button"
        >
          Update
        </button>
      )}
    </div>
  );
}
