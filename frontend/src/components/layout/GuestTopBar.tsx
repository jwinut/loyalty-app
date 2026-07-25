import { Link, NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FiUser } from 'react-icons/fi';
import { BrandLogo } from '../brand/BrandLogo';
import LanguageSwitcher from '../LanguageSwitcher';
import NotificationCenter from '../notifications/NotificationCenter';
import { cn } from '../ui/cn';

export type GuestTopBarProps = {
  title?: string;
};

type GuestNavLink = { to: string; labelKey: string };

const GUEST_NAV_LINKS: GuestNavLink[] = [
  { to: '/dashboard', labelKey: 'nav.home' },
  { to: '/member-card', labelKey: 'nav.memberCard' },
  { to: '/coupons', labelKey: 'nav.coupons' },
  { to: '/my-bookings', labelKey: 'nav.bookings' },
  { to: '/surveys', labelKey: 'nav.surveys' },
];

/**
 * Guest app header. Sticky (not fixed) so it scrolls with the page but
 * pins to the top while a page is tall enough to scroll. Shows the
 * desktop nav links at lg+; on narrower viewports it shows the page
 * title in their place, and the language switcher / profile chip fold
 * away (bell stays — see NotificationCenter).
 */
export default function GuestTopBar({ title }: GuestTopBarProps) {
  const { t } = useTranslation();

  return (
    <header
      className="sticky top-0 z-30 border-b border-hairline bg-surface-page/80 backdrop-blur-md"
      data-testid="guest-top-bar"
    >
      <div className="mx-auto flex h-12 max-w-page items-center justify-between gap-4 px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Link
          to="/dashboard"
          className="flex shrink-0 items-center gap-2"
          data-testid="guest-top-bar-logo"
        >
          <BrandLogo variant="monogram" />
          <BrandLogo variant="wordmark" className="hidden sm:block" />
        </Link>

        {/* Mobile/tablet: page title stands in for the desktop nav links */}
        <span className="truncate text-title text-ink lg:hidden">{title}</span>

        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label={t('nav.home')}
        >
          {GUEST_NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'text-caption',
                  isActive
                    ? 'font-semibold text-brand-700'
                    : 'text-ink-muted hover:text-ink',
                )
              }
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden lg:block">
            <LanguageSwitcher />
          </div>
          <NotificationCenter />
          <Link
            to="/profile"
            className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-ink-muted hover:text-ink lg:flex"
            aria-label={t('nav.profile')}
            data-testid="guest-top-bar-profile-chip"
          >
            <FiUser size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
