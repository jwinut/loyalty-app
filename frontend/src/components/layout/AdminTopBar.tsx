import LanguageSwitcher from '../LanguageSwitcher';
import DashboardButton from '../navigation/DashboardButton';

export type AdminTopBarProps = {
  title?: string;
};

/**
 * Admin header. `sticky`, NEVER `fixed` — AdminPortalBand injects the HF
 * One portal band above this in normal document flow on `/admin/*`, and a
 * `fixed` header would overlap it instead of stacking below.
 */
export default function AdminTopBar({ title }: AdminTopBarProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-hairline bg-surface-page/80 backdrop-blur-md"
      data-testid="admin-top-bar"
    >
      <div className="mx-auto flex h-12 max-w-page items-center justify-between gap-4 px-4 sm:px-6">
        <DashboardButton variant="outline" size="sm" />
        <span className="truncate text-title text-ink">{title}</span>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
