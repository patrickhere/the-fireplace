import { useState, useEffect } from 'react';

export type Platform = 'macos' | 'ios' | 'unknown';

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    const detectPlatform = async () => {
      try {
        // Try to import Tauri API
        const { platform: tauriPlatform } = await import('@tauri-apps/plugin-os');
        const platformName = await tauriPlatform();

        if (platformName === 'macos') {
          setPlatform('macos');
        } else if (platformName === 'ios') {
          setPlatform('ios');
        } else {
          setPlatform('unknown');
        }
      } catch {
        // If Tauri API is not available, fall back to user agent
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('mac')) {
          setPlatform('macos');
        } else if (ua.includes('iphone') || ua.includes('ipad')) {
          setPlatform('ios');
        } else {
          setPlatform('unknown');
        }
      }
    };

    detectPlatform();
  }, []);

  return platform;
}

export function useIsMobile(): boolean {
  const platform = usePlatform();
  return platform === 'ios';
}
