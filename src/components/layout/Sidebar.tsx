import { NavLink, useNavigate } from 'react-router-dom';
import {
  IconUser,
  IconBookmark,
  IconHistory,
  IconSettings,
  IconCompass,
  IconAutomata,
  IconControl,
  IconLogout,
} from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { ComponentType, SVGProps } from 'react';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  group: 'main' | 'domain' | 'system';
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app/history', label: 'History', Icon: IconHistory, group: 'main' },
  { to: '/app/saved', label: 'Saved', Icon: IconBookmark, group: 'main' },
  { to: '/app/profile', label: 'Profile', Icon: IconUser, group: 'main' },
  { to: '/app/graphics', label: 'Graphics', Icon: IconCompass, group: 'domain' },
  { to: '/app/automata', label: 'Automata', Icon: IconAutomata, group: 'domain' },
  { to: '/app/control', label: 'Control Systems', Icon: IconControl, group: 'domain' },
  { to: '/app/settings', label: 'Settings', Icon: IconSettings, group: 'system' },
];

const GROUP_LABELS: Record<NavItem['group'], string> = {
  main: 'Workspace',
  domain: 'Modules',
  system: 'System',
};

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const groups: NavItem['group'][] = ['main', 'domain', 'system'];

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border-subtle bg-bg-secondary">
      <div className="flex h-14 items-center px-4 border-b border-border-subtle">
        <Logo withText size={22} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, gi) => (
          <div key={group} className={cn(gi > 0 && 'mt-6')}>
            <div className="px-3 mb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-muted">
              {GROUP_LABELS[group]}
            </div>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
                <NavItemLink key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-subtle p-3 space-y-1">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] border border-border-subtle text-[10.5px] font-semibold text-text-primary">
              {(user.displayName ?? user.email ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-text-primary">
                {user.displayName ?? 'User'}
              </div>
              <div className="truncate text-[11px] text-text-muted">
                {user.email ?? ''}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:bg-white/[0.04] hover:text-text-primary"
        >
          <IconLogout className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

function NavItemLink({ to, label, Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150',
          isActive
            ? 'bg-white/[0.06] text-text-primary'
            : 'text-text-secondary hover:bg-white/[0.03] hover:text-text-primary'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
