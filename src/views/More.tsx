import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const moreItems = [
  { label: 'Config', path: '/config' },
  { label: 'Approvals', path: '/approvals' },
  { label: 'Cron', path: '/cron' },
  { label: 'Skills', path: '/skills' },
  { label: 'Devices', path: '/devices' },
  { label: 'Logs', path: '/logs' },
  { label: 'Models', path: '/models' },
  { label: 'Usage', path: '/usage' },
];

export function More() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-700 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">More</h2>
        <p className="text-sm text-zinc-400">Additional views and settings</p>
      </div>
      <div className="flex-1 p-4">
        <nav>
          <ul className="space-y-2">
            {moreItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm transition-colors hover:bg-zinc-800'
                  )}
                >
                  <span className="text-zinc-100">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
