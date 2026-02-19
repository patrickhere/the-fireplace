import { useEffect, useState } from 'react';

import { useChatStore } from '@/stores/chat';
import { useConnectionStore } from '@/stores/connection';
import { formatSessionKey } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SessionSelector() {
  const { activeSessionKey, setActiveSession } = useChatStore();
  const [sessions, setSessions] = useState<
    Array<{ key: string; label?: string; derivedTitle?: string }>
  >([]);
  const { request, status, snapshot } = useConnectionStore();

  useEffect(() => {
    if (status !== 'connected') return;

    const loadSessions = async () => {
      try {
        const response = await request<{
          sessions: Array<{
            key: string;
            label?: string;
            derivedTitle?: string;
            lastActive?: number;
          }>;
        }>('sessions.list', {
          limit: 100,
          includeDerivedTitles: true,
          includeGlobal: true,
          includeUnknown: true,
        });
        const sessionList = response.sessions || [];
        const mainSessionKey = snapshot?.sessionDefaults?.mainSessionKey?.trim();

        if (sessionList.length === 0 && mainSessionKey) {
          const fallback = [{ key: mainSessionKey, label: 'Main' }];
          setSessions(fallback);
          if (!activeSessionKey) {
            setActiveSession(mainSessionKey);
          }
          return;
        }

        setSessions(sessionList);

        if (!activeSessionKey && sessionList.length > 0) {
          const preferred = mainSessionKey
            ? sessionList.find((session) => session.key === mainSessionKey)
            : undefined;
          const target = preferred ?? sessionList[0];
          if (target && target.key !== activeSessionKey) {
            setActiveSession(target.key);
          }
        }
      } catch (err) {
        console.error('[Chat] Failed to load sessions:', err);
      }
    };

    void loadSessions();
  }, [status, request, snapshot, activeSessionKey, setActiveSession]);

  if (sessions.length === 0) {
    return <div className="text-sm text-zinc-500">No sessions available</div>;
  }

  return (
    <Select value={activeSessionKey ?? undefined} onValueChange={setActiveSession}>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Select a session" />
      </SelectTrigger>
      <SelectContent>
        {sessions.map((session) => (
          <SelectItem key={session.key} value={session.key}>
            {formatSessionKey(session.key, session.derivedTitle || session.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
