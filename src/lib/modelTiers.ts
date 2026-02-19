/**
 * Model/provider tier classification for cost-aware UI rendering.
 *
 * Copilot proxy billing is server-side by MODEL, not endpoint.
 * Tiers reflect the actual GitHub premium request multipliers.
 */

export type ModelTier = 'free' | 'cheap' | 'premium' | 'max' | 'unknown';

export interface TierInfo {
  tier: ModelTier;
  label: string;
  /** Tailwind color class for badges/dots */
  color: string;
  /** Premium request multiplier (0 = unlimited) */
  multiplier: number;
}

const TIER_INFO: Record<ModelTier, Omit<TierInfo, 'tier'>> = {
  free: { label: 'Free', color: 'emerald', multiplier: 0 },
  cheap: { label: 'Low Cost', color: 'sky', multiplier: 0.33 },
  premium: { label: 'Premium', color: 'amber', multiplier: 1 },
  max: { label: 'MAX Sub', color: 'violet', multiplier: 0 },
  unknown: { label: 'Unknown', color: 'zinc', multiplier: 0 },
};

/** Models that are truly unlimited (0x multiplier) on Copilot Pro */
const FREE_MODELS = new Set(['gpt-4.1', 'gpt-5-mini', 'gpt-4o', 'raptor-mini']);

/** Models at 0.33x multiplier (~900 calls/mo on 300 budget) */
const CHEAP_MODELS = new Set([
  'claude-haiku-4.5',
  'gemini-3-flash',
  'gemini-3-flash-preview',
  'gpt-5.1-codex-mini',
]);

/** Provider prefixes that indicate the MAX subscription (direct API) */
const MAX_PROVIDERS = new Set(['anthropic']);

/** Provider prefixes for Gemini free tier */
const GEMINI_FREE_PROVIDERS = new Set(['google']);

/**
 * Classify a fully-qualified model ID (e.g. "copilot-free/gpt-4.1")
 * into its cost tier.
 */
export function classifyModel(modelId: string): TierInfo {
  const [provider, model] = splitModelId(modelId);

  // Direct Anthropic API = MAX subscription
  if (MAX_PROVIDERS.has(provider)) {
    return { tier: 'max', ...TIER_INFO.max };
  }

  // Google/Gemini free tier
  if (GEMINI_FREE_PROVIDERS.has(provider)) {
    return { tier: 'free', ...TIER_INFO.free };
  }

  // Copilot proxy — classify by model name
  if (provider.startsWith('copilot')) {
    if (FREE_MODELS.has(model)) {
      return { tier: 'free', ...TIER_INFO.free };
    }
    if (CHEAP_MODELS.has(model)) {
      return { tier: 'cheap', ...TIER_INFO.cheap };
    }
    return { tier: 'premium', ...TIER_INFO.premium };
  }

  return { tier: 'unknown', ...TIER_INFO.unknown };
}

/**
 * Split "provider/model" into [provider, model].
 * Handles legacy naming: "copilot/", "copilot-openai/" → normalized.
 */
export function splitModelId(modelId: string): [string, string] {
  const slashIdx = modelId.indexOf('/');
  if (slashIdx === -1) return ['unknown', modelId];
  return [modelId.slice(0, slashIdx), modelId.slice(slashIdx + 1)];
}

/**
 * Normalize legacy provider names to the canonical scheme.
 * "copilot/claude-haiku-4.5" → "copilot-cheap/claude-haiku-4.5"
 * "copilot-openai/gpt-4.1"  → "copilot-free/gpt-4.1"
 * "copilot-openai/gpt-5"    → "copilot-premium/gpt-5"  (1x model)
 */
export function normalizeModelId(modelId: string): string {
  const [provider, model] = splitModelId(modelId);

  // Already using canonical names
  if (
    provider === 'copilot-free' ||
    provider === 'copilot-cheap' ||
    provider === 'copilot-premium'
  ) {
    return modelId;
  }

  // Non-copilot providers pass through
  if (!provider.startsWith('copilot')) {
    return modelId;
  }

  // Legacy copilot/ or copilot-openai/ — reclassify by model
  if (FREE_MODELS.has(model)) return `copilot-free/${model}`;
  if (CHEAP_MODELS.has(model)) return `copilot-cheap/${model}`;
  return `copilot-premium/${model}`;
}

/** Get the Tailwind badge classes for a model tier */
export function tierBadgeClasses(tier: ModelTier): string {
  const colors: Record<ModelTier, string> = {
    free: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    cheap: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    premium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    max: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    unknown: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  };
  return `text-xs px-1.5 py-0.5 rounded border ${colors[tier]}`;
}
