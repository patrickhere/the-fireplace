// ---------------------------------------------------------------------------
// Conflict Detection — Heuristic file/topic conflict detection between demons
// ---------------------------------------------------------------------------

export interface DemonConflict {
  id: string;
  type: 'file' | 'topic';
  resource: string; // file path or topic name
  demons: { id: string; name: string; emoji: string; timestamp: number }[];
  detectedAt: number;
  resolved: boolean;
}

export interface ActivityEntry {
  demonId: string;
  demonName: string;
  demonEmoji: string;
  text: string;
  timestamp: number;
}

// ---- Constants ------------------------------------------------------------

const CONFLICT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// File path pattern: matches paths with recognized extensions
const FILE_PATH_PATTERN =
  /(?:^|[\s"'`(])([a-zA-Z0-9_./-]+\.(?:ts|tsx|rs|js|jsx|json|md|toml|yaml|yml|css|html|py|sh|env))/g;

// Topic stop words — short or too common to be meaningful
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'have',
  'will',
  'task',
  'done',
  'work',
  'file',
  'data',
  'code',
  'func',
  'type',
  'into',
  'about',
  'using',
  'build',
  'start',
  'check',
  'when',
  'then',
  'also',
  'need',
  'make',
  'sure',
  'can',
  'use',
  'its',
  'are',
  'been',
  'was',
  'agent',
  'demon',
  'model',
  'session',
  'message',
  'event',
  'store',
  'state',
]);

// ---- Helpers --------------------------------------------------------------

let conflictCounter = 0;

function generateConflictId(): string {
  conflictCounter += 1;
  return `conflict-${Date.now()}-${conflictCounter}`;
}

/**
 * Extract file paths from text. Returns normalized lowercase paths.
 */
function extractFilePaths(text: string): string[] {
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(FILE_PATH_PATTERN.source, FILE_PATH_PATTERN.flags);
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[1];
    if (raw && raw.length > 3) {
      paths.push(raw.toLowerCase());
    }
  }
  return [...new Set(paths)];
}

/**
 * Extract significant keywords (nouns/topics) from text.
 * Returns lowercase words longer than 5 chars that are not stop words.
 */
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 5 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

// ---- Detection Logic ------------------------------------------------------

/**
 * Detect file path conflicts: two different demons referencing the same file
 * within the conflict time window.
 */
function detectFileConflicts(activity: ActivityEntry[]): DemonConflict[] {
  const conflicts: DemonConflict[] = [];

  // Build a map: filePath -> list of {demonId, demonName, demonEmoji, timestamp}
  const fileMap = new Map<
    string,
    { id: string; name: string; emoji: string; timestamp: number }[]
  >();

  for (const entry of activity) {
    const paths = extractFilePaths(entry.text);
    for (const path of paths) {
      const existing = fileMap.get(path) ?? [];
      existing.push({
        id: entry.demonId,
        name: entry.demonName,
        emoji: entry.demonEmoji,
        timestamp: entry.timestamp,
      });
      fileMap.set(path, existing);
    }
  }

  // Check each file for multi-demon access within the window
  for (const [filePath, mentions] of fileMap.entries()) {
    if (mentions.length < 2) continue;

    // Group by demon, keeping the latest mention per demon
    const byDemon = new Map<
      string,
      { id: string; name: string; emoji: string; timestamp: number }
    >();
    for (const mention of mentions) {
      const existing = byDemon.get(mention.id);
      if (!existing || mention.timestamp > existing.timestamp) {
        byDemon.set(mention.id, mention);
      }
    }

    if (byDemon.size < 2) continue;

    // Check if any two different demons accessed the file within the window
    const demonList = [...byDemon.values()].sort((a, b) => a.timestamp - b.timestamp);
    const first = demonList[0];
    const last = demonList[demonList.length - 1];
    if (!first || !last) continue;

    if (last.timestamp - first.timestamp <= CONFLICT_WINDOW_MS) {
      conflicts.push({
        id: generateConflictId(),
        type: 'file',
        resource: filePath,
        demons: demonList,
        detectedAt: Date.now(),
        resolved: false,
      });
    }
  }

  return conflicts;
}

/**
 * Detect topic conflicts: two different demons using the same significant
 * keyword within the conflict time window.
 */
function detectTopicConflicts(activity: ActivityEntry[]): DemonConflict[] {
  const conflicts: DemonConflict[] = [];

  // Build a map: keyword -> list of mentions
  const topicMap = new Map<
    string,
    { id: string; name: string; emoji: string; timestamp: number }[]
  >();

  for (const entry of activity) {
    const keywords = extractKeywords(entry.text);
    for (const keyword of keywords) {
      const existing = topicMap.get(keyword) ?? [];
      existing.push({
        id: entry.demonId,
        name: entry.demonName,
        emoji: entry.demonEmoji,
        timestamp: entry.timestamp,
      });
      topicMap.set(keyword, existing);
    }
  }

  // Check each topic for multi-demon usage within the window
  for (const [keyword, mentions] of topicMap.entries()) {
    if (mentions.length < 2) continue;

    // Group by demon, keeping the latest mention per demon
    const byDemon = new Map<
      string,
      { id: string; name: string; emoji: string; timestamp: number }
    >();
    for (const mention of mentions) {
      const existing = byDemon.get(mention.id);
      if (!existing || mention.timestamp > existing.timestamp) {
        byDemon.set(mention.id, mention);
      }
    }

    if (byDemon.size < 2) continue;

    const demonList = [...byDemon.values()].sort((a, b) => a.timestamp - b.timestamp);
    const first = demonList[0];
    const last = demonList[demonList.length - 1];
    if (!first || !last) continue;

    if (last.timestamp - first.timestamp <= CONFLICT_WINDOW_MS) {
      conflicts.push({
        id: generateConflictId(),
        type: 'topic',
        resource: keyword,
        demons: demonList,
        detectedAt: Date.now(),
        resolved: false,
      });
    }
  }

  return conflicts;
}

/**
 * Main entry point. Takes recent activity entries and returns detected conflicts.
 * Deduplicates by resource — only one conflict per unique file/topic.
 */
export function detectConflicts(activity: ActivityEntry[]): DemonConflict[] {
  if (activity.length < 2) return [];

  // Only consider activity within the last 10 minutes
  const cutoff = Date.now() - CONFLICT_WINDOW_MS;
  const recent = activity.filter((e) => e.timestamp >= cutoff);

  if (recent.length < 2) return [];

  const fileConflicts = detectFileConflicts(recent);
  const topicConflicts = detectTopicConflicts(recent);

  // Merge, deduplicating by resource+type
  const seen = new Set<string>();
  const all: DemonConflict[] = [];

  for (const conflict of [...fileConflicts, ...topicConflicts]) {
    const key = `${conflict.type}:${conflict.resource}`;
    if (!seen.has(key)) {
      seen.add(key);
      all.push(conflict);
    }
  }

  return all;
}
