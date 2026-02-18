import { useState, useEffect } from 'react';

export type Platform = 'macos' | 'ios' | 'unknown';

// Module-level cache — detection runs once across all hook instances.
// Subsequent calls return immediately without async overhead, eliminating
// the flash where platform is 'unknown' on re-renders.
let cachedPlatform: Platform | null = null;

async function detectPlatform(): Promise<Platform> {
  if (cachedPlatform !== null) return cachedPlatform;

  try {
    const { platform: tauriPlatform } = await import('@tauri-apps/plugin-os');
    const platformName = await tauriPlatform();

    if (platformName === 'macos') {
      cachedPlatform = 'macos';
    } else if (platformName === 'ios') {
      cachedPlatform = 'ios';
    } else {
      cachedPlatform = 'unknown';
    }
  } catch {
    // If Tauri API is not available, fall back to user agent
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) {
      cachedPlatform = 'macos';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      cachedPlatform = 'ios';
    } else {
      cachedPlatform = 'unknown';
    }
  }

  return cachedPlatform;
}

export function usePlatform(): Platform {
  // Initialise immediately from cache if available — avoids first-render flash
  const [platform, setPlatform] = useState<Platform>(() => cachedPlatform ?? 'unknown');

  useEffect(() => {
    if (cachedPlatform !== null) {
      // Already resolved — just sync state if needed
      if (platform !== cachedPlatform) setPlatform(cachedPlatform);
      return;
    }

    detectPlatform()
      .then(setPlatform)
      .catch(() => setPlatform('unknown'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return platform;
}

export function useIsMobile(): boolean {
  const platform = usePlatform();
  return platform === 'ios';
}
