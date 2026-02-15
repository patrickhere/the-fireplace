import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ConnectionStatus } from './ConnectionStatus';
import { formatShortcut } from '@/hooks/useKeyboard';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
  shortcut?: string;
}

const navItems: NavItem[] = [
  { label: 'Chat', path: '/', icon: '>', shortcut: 'cmd+1' },
  { label: 'Sessions', path: '/sessions', icon: '=', shortcut: 'cmd+2' },
  { label: 'Channels', path: '/channels', icon: '#', shortcut: 'cmd+3' },
  { label: 'Agents', path: '/agents', icon: '@', shortcut: 'cmd+4' },
  { label: 'Config', path: '/config', icon: '*', shortcut: 'cmd+5' },
  { label: 'Approvals', path: '/approvals', icon: '?', shortcut: 'cmd+6' },
  { label: 'Cron', path: '/cron', icon: '~', shortcut: 'cmd+7' },
  { label: 'Skills', path: '/skills', icon: '+', shortcut: 'cmd+8' },
  { label: 'Devices', path: '/devices', icon: '.', shortcut: 'cmd+9' },
  { label: 'Logs', path: '/logs', icon: '|' },
  { label: 'Models', path: '/models', icon: '%' },
  { label: 'Usage', path: '/usage', icon: '$' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-700 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-700 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 font-mono text-sm text-amber-400">
          F
        </div>
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
                    <span className="flex h-5 w-5 items-center justify-center font-mono text-xs">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                        {item.badge}
                      </span>
                    )}
                    {item.shortcut && (
                      <span className="text-xs text-zinc-600">{formatShortcut(item.shortcut)}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Command palette hint */}
      <div className="border-t border-zinc-700 px-3 py-2">
        <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-500">
          <span>Search commands...</span>
          <kbd className="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs text-zinc-400">
            {formatShortcut('cmd+k')}
          </kbd>
        </div>
      </div>

      {/* Connection Status */}
      <div className="border-t border-zinc-700 p-3">
        <ConnectionStatus />
      </div>
    </aside>
  );
}
