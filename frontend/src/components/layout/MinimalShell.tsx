import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '../brand/BrandLogo';
import LanguageSwitcher from '../LanguageSwitcher';

export type MinimalShellProps = {
  children: ReactNode;
};

/**
 * Centered single-column shell for focus flows (auth, standalone pages).
 * No nav chrome at all — just brand, content, and the privacy footer link.
 */
export default function MinimalShell({ children }: MinimalShellProps) {
  const { t } = useTranslation();

  return (
    <div className="relative mx-auto max-w-md px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col items-center gap-8">
        <BrandLogo variant="lockup" />
        {children}
      </div>

      <footer className="mt-10 text-center">
        <Link
          to="/privacy"
          className="text-caption text-ink-muted hover:text-ink"
          data-testid="footer-privacy-link"
        >
          {t('privacy.footerLink')}
        </Link>
      </footer>
    </div>
  );
}
