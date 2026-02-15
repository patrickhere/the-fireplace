import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ConnectionStatus } from './ConnectionStatus';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Chat', path: '/', icon: '💬' },
  { label: 'Sessions', path: '/sessions', icon: '📋' },
  { label: 'Channels', path: '/channels', icon: '📡' },
  { label: 'Agents', path: '/agents', icon: '🤖' },
  { label: 'Config', path: '/config', icon: '⚙️' },
  { label: 'Approvals', path: '/approvals', icon: '✓' },
  { label: 'Cron', path: '/cron', icon: '⏰' },
  { label: 'Skills', path: '/skills', icon: '🔌' },
  { label: 'Devices', path: '/devices', icon: '📱' },
  { label: 'Logs', path: '/logs', icon: '📜' },
  { label: 'Models', path: '/models', icon: '🧠' },
  { label: 'Usage', path: '/usage', icon: '📊' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-zinc-700 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-700 p-4">
        <div className="text-2xl">🔥</div>
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">The Fireplace</h1>
          <p className="text-xs text-zinc-500">Mission Control</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'border-l-2 border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Connection Status */}
      <div className="border-t border-zinc-700 p-3">
        <ConnectionStatus />
      </div>
    </aside>
  );
}
