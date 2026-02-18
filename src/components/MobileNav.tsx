import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavTab {
  label: string;
  path: string;
  icon: string;
}

const primaryTabs: NavTab[] = [
  { label: 'Chat', path: '/', icon: '💬' },
  { label: 'Sessions', path: '/sessions', icon: '📋' },
  { label: 'Channels', path: '/channels', icon: '📡' },
  { label: 'Agents', path: '/agents', icon: '🤖' },
  { label: 'More', path: '/more', icon: '⋯' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 border-t border-zinc-700 bg-zinc-900">
      <div className="flex items-center justify-around">
        {primaryTabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 transition-colors',
                isActive ? 'text-amber-400' : 'text-zinc-400'
              )}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
