// ---------------------------------------------------------------------------
// Plan Extraction — extracts reusable plan skeletons from task descriptions
// ---------------------------------------------------------------------------

/**
 * Normalize a task description into a cache key by:
 * 1. Lowercasing
 * 2. Removing punctuation
 * 3. Removing stop words
 * 4. Sorting remaining words
 * 5. Joining with spaces
 *
 * This produces a canonical form so "Review the PR for auth" and
 * "review PR auth" yield the same key.
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'it',
  'this',
  'that',
  'as',
  'be',
  'was',
  'are',
  'been',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'has',
  'have',
  'had',
  'not',
  'no',
  'so',
  'if',
  'then',
  'than',
  'too',
  'very',
  'just',
  'about',
  'up',
  'out',
  'all',
  'also',
  'please',
]);

export function normalizeDescription(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/\[task::[^\]]*\]/g, '') // strip task markers
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  // Deduplicate and sort for canonical ordering
  const unique = [...new Set(words)].sort();
  return unique.join(' ');
}

/**
 * Simple hash of a normalized description for use as cache key.
 * Uses djb2 algorithm — fast, good distribution, no crypto needed.
 */
export function hashDescription(normalized: string): string {
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  // Convert to unsigned hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Extract a plan skeleton from chat history text.
 * Looks for structured markers like numbered steps, bullet points,
 * or common plan patterns. Returns a cleaned skeleton string.
 */
export function extractPlanSkeleton(chatText: string): string | null {
  const lines = chatText.split('\n');
  const planLines: string[] = [];
  let inPlan = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect plan-like sections
    if (
      /^(plan|steps|approach|strategy|tasks?):/i.test(trimmed) ||
      /^#{1,3}\s*(plan|steps|approach)/i.test(trimmed)
    ) {
      inPlan = true;
      planLines.push(trimmed);
      continue;
    }

    // Collect numbered steps or bullet points
    if (/^(\d+[.)]|\*|-|•)\s/.test(trimmed)) {
      inPlan = true;
      planLines.push(trimmed);
      continue;
    }

    // If we were in a plan section and hit a non-plan line, keep collecting
    // for a bit (plans often have explanatory text between steps)
    if (inPlan && trimmed.length > 0) {
      // Stop if we hit another heading that's not plan-related
      if (/^#{1,3}\s/.test(trimmed) && !/plan|step|approach/i.test(trimmed)) {
        inPlan = false;
        continue;
      }
      planLines.push(trimmed);
    }

    // Empty line — if we have enough plan lines already, this might be the end
    if (inPlan && trimmed.length === 0 && planLines.length > 3) {
      planLines.push('');
    }
  }

  if (planLines.length < 2) return null;

  // Trim trailing empty lines
  while (planLines.length > 0 && planLines[planLines.length - 1] === '') {
    planLines.pop();
  }

  return planLines.join('\n');
}

/**
 * Compute similarity between two normalized descriptions.
 * Returns a value between 0 and 1.
 * Uses Jaccard similarity on word sets.
 */
export function descriptionSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}
