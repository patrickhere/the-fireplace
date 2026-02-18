import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Toaster } from 'sonner';
import { useIsMobile } from '@/hooks/usePlatform';
import { useConnectionStore } from '@/stores/connection';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { CommandPalette } from '@/components/CommandPalette';
import { GlobalShortcuts } from '@/components/GlobalShortcuts';
import { UpdateBanner } from '@/components/UpdateBanner';

// Views
import { Chat } from '@/views/Chat';
import { Sessions } from '@/views/Sessions';
import { Channels } from '@/views/Channels';
import { Agents } from '@/views/Agents';
import { Config } from '@/views/Config';
import { Approvals } from '@/views/Approvals';
import { Cron } from '@/views/Cron';
import { Skills } from '@/views/Skills';
import { Devices } from '@/views/Devices';
import { Logs } from '@/views/Logs';
import { Models } from '@/views/Models';
import { Usage } from '@/views/Usage';
import { More } from '@/views/More';
import { DemonChatRoom } from '@/views/DemonChatRoom';
import { DemonHealth } from '@/views/DemonHealth';
import { DemonKanban } from '@/views/DemonKanban';

function App() {
  const isMobile = useIsMobile();
  const { connect, status } = useConnectionStore();
  const connectAttempted = useRef(false);

  // Auto-connect on app startup — use a ref to prevent double-invocation
  // while still correctly reading status from state
  useEffect(() => {
    if (!connectAttempted.current && status === 'disconnected') {
      connectAttempted.current = true;
      connect().catch((err) => {
        console.error('[App] Auto-connect failed:', err);
      });
    }
  }, [status, connect]);

  return (
    <BrowserRouter>
      {/* Toast notifications */}
      <Toaster theme="dark" richColors position="bottom-right" />

      {/* Global keyboard shortcuts (Cmd+1-9, Cmd+N) */}
      <GlobalShortcuts />

      {/* Command palette overlay (Cmd+K) */}
      <CommandPalette />

      <div className="flex h-screen flex-col overflow-hidden bg-zinc-950">
        {/* Update banner — macOS only, shows when update available */}
        <UpdateBanner />

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop: Sidebar */}
          {!isMobile && <Sidebar />}

          {/* Main content area */}
          <main
            className="flex-1 overflow-auto pb-0 md:pb-0"
            style={{ paddingBottom: isMobile ? '56px' : 0 }}
          >
            <Routes>
              <Route path="/" element={<Chat />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/channels" element={<Channels />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/config" element={<Config />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/cron" element={<Cron />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/models" element={<Models />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/more" element={<More />} />
              <Route path="/demon-chat" element={<DemonChatRoom />} />
              <Route path="/demon-health" element={<DemonHealth />} />
              <Route path="/demon-tasks" element={<DemonKanban />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Mobile: Bottom Navigation */}
          {isMobile && <MobileNav />}
        </div>
      </div>
    </BrowserRouter>
  );
}

export { App };
