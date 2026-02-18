import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format raw session keys into friendly display names.
 * - "agent:calcifer:main" → "Calcifer"
 * - "agent:buer:task-123" → "Buer (task-123)"
 * - "main" → "Main"
 */
export function formatSessionKey(key: string, label?: string | null): string {
  if (label) return label;

  const agentMatch = key.match(/^agent:([^:]+)(?::(.+))?$/);
  if (agentMatch && agentMatch[1]) {
    const name = agentMatch[1].charAt(0).toUpperCase() + agentMatch[1].slice(1);
    const suffix = agentMatch[2];
    if (!suffix || suffix === 'main') return name;
    return `${name} (${suffix})`;
  }

  if (key === 'main') return 'Main';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
