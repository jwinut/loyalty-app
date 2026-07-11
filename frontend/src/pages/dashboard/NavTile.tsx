import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiChevronRight } from 'react-icons/fi';
import { Card } from '../../components/ui/Card';
import type { NavCardDef } from './navCards';

export type NavTileProps = {
  card: NavCardDef;
};

/**
 * One dashboard nav card: the whole tile is the tap target (Link wraps the
 * Card), with a leading icon chip, title/description, and a trailing chevron.
 */
export default function NavTile({ card }: NavTileProps) {
  const { t } = useTranslation();
  const Icon = card.icon;

  return (
    <Link to={card.to} data-testid={card.testId}>
      <Card
        padding="md"
        className="flex min-h-[44px] items-center gap-4 transition hover:border-hairline-strong"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{t(card.titleKey)}</span>
          <span className="block truncate text-caption text-ink-muted">{t(card.descKey)}</span>
        </span>
        <FiChevronRight className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden="true" />
      </Card>
    </Link>
  );
}
