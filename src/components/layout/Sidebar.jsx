import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity, BarChart2, Settings, Zap, TrendingUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/predictions', label: 'Predictions', icon: Zap },
  { path: '/live', label: 'Live Matches', icon: Activity },
  { path: '/backtesting', label: 'Backtesting', icon: TrendingUp },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/admin', label: 'Admin', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-sidebar-foreground tracking-tight">FootballIQ</div>
            <div className="text-xs text-sidebar-foreground/50">Prediction Engine</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-accent-blue' : '')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Engine Active
        </div>
      </div>
    </div>
  );
}
