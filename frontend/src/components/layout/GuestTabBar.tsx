import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  FiHome,
  FiCreditCard,
  FiGift,
  FiCalendar,
  FiUser,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { cn } from '../ui/cn';

type TabItem = { to: string; labelKey: string; icon: IconType; testId: string };

const TAB_ITEMS: TabItem[] = [
  { to: '/dashboard', labelKey: 'nav.home', icon: FiHome, testId: 'home' },
  {
    to: '/member-card',
    labelKey: 'nav.memberCard',
    icon: FiCreditCard,
    testId: 'card',
  },
  { to: '/coupons', labelKey: 'nav.coupons', icon: FiGift, testId: 'coupons' },
  {
    to: '/my-bookings',
    labelKey: 'nav.bookings',
    icon: FiCalendar,
    testId: 'bookings',
  },
  { to: '/profile', labelKey: 'nav.profile', icon: FiUser, testId: 'profile' },
];

/**
 * Mobile bottom tab bar for the guest app — hidden at lg+ where the
 * GuestTopBar's nav links take over. `fixed` (not sticky) is intentional
 * here: it must stay pinned to the viewport bottom regardless of scroll,
 * clear of the LINE webview's home-indicator safe area.
 */
export default function GuestTabBar() {
  const { t } = useTranslation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      data-testid="guest-tab-bar"
    >
      <div className="flex h-14">
        {TAB_ITEMS.map(({ to, labelKey, icon: Icon, testId }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`tab-${testId}`}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]',
                isActive ? 'text-brand-600' : 'text-ink-muted',
              )
            }
          >
            <Icon size={22} aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
