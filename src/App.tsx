import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useIsMobile } from '@/hooks/usePlatform';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';

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

function App() {
  const isMobile = useIsMobile();

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-zinc-950">
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
          </Routes>
        </main>

        {/* Mobile: Bottom Navigation */}
        {isMobile && <MobileNav />}
      </div>
    </BrowserRouter>
  );
}

export default App;
