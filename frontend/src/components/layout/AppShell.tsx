import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import ProfileCompletionBanner from '../profile/ProfileCompletionBanner';
import { BrandLogo } from '../brand/BrandLogo';
import GuestTopBar from './GuestTopBar';
import GuestTabBar from './GuestTabBar';
import AdminTopBar from './AdminTopBar';
import AdminNavRail from './AdminNavRail';
import MinimalShell from './MinimalShell';

export type AppShellVariant = 'guest' | 'admin' | 'minimal';

export type AppShellProps = {
  variant: AppShellVariant;
  title?: string;
  hideTabBar?: boolean;
  showProfileBanner?: boolean;
  fullBleed?: boolean;
  children: ReactNode;
};

const CONTENT_CLASSES = 'mx-auto max-w-page px-4 py-6 sm:px-6';

/**
 * Single app shell for every route family:
 *  - `guest`: top bar + bottom tab bar for the member-facing app (LIFF webview).
 *  - `admin`: top bar + horizontal section rail for staff pages (no tab bar/banner).
 *  - `minimal`: centered column with no nav chrome, for focus flows.
 */
export default function AppShell({
  variant,
  title,
  hideTabBar = false,
  showProfileBanner = true,
  fullBleed = false,
  children,
}: AppShellProps) {
  const { t } = useTranslation();

  if (variant === 'minimal') {
    return (
      <div className="min-h-screen bg-surface-page">
        <MinimalShell>{children}</MinimalShell>
      </div>
    );
  }

  if (variant === 'admin') {
    return (
      <div className="min-h-screen bg-surface-page">
        <AdminTopBar title={title} />
        <AdminNavRail />
        <main className={fullBleed ? undefined : CONTENT_CLASSES}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page">
      {showProfileBanner && <ProfileCompletionBanner />}
      <GuestTopBar title={title} />

      <main className={fullBleed ? undefined : CONTENT_CLASSES}>
        {children}
      </main>

      {!hideTabBar && <GuestTabBar />}

      <footer className="mx-auto max-w-page px-4 pb-24 pt-6 text-center sm:px-6 lg:pb-6">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo variant="monogram" />
          <div className="flex items-center gap-4">
            <Link
              to="/benefits"
              className="text-caption text-ink-muted hover:text-ink"
              data-testid="footer-benefits-link"
            >
              {t('tierBenefits.footerLink')}
            </Link>
            <Link
              to="/privacy"
              className="text-caption text-ink-muted hover:text-ink"
              data-testid="footer-privacy-link"
            >
              {t('privacy.footerLink')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
