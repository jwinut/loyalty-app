import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import AppShell from '../components/layout/AppShell';
import { Card } from '../components/ui';

/**
 * PDPA privacy notice. Publicly reachable (no auth) — linked from the
 * footer and the OA rich menus. Documents the friendship-as-opt-in
 * position: membership operates as contract; the LINE OA friendship is the
 * messaging opt-in and blocking the OA is the opt-out.
 */
export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <AppShell variant="guest" title={t('privacy.title')}>
      <div className="mx-auto max-w-text space-y-6">
        <Card>
          <h2 className="mb-2 text-title text-ink">{t('privacy.whatWeStoreTitle')}</h2>
          <p className="text-body text-ink-muted">{t('privacy.whatWeStoreBody')}</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-title text-ink">{t('privacy.whyTitle')}</h2>
          <p className="text-body text-ink-muted">{t('privacy.whyBody')}</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-title text-ink">{t('privacy.messagesTitle')}</h2>
          <p className="text-body text-ink-muted">{t('privacy.messagesBody')}</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-title text-ink">{t('privacy.contactTitle')}</h2>
          <p className="text-body text-ink-muted">{t('privacy.contactBody')}</p>
        </Card>

        <div className="text-center">
          <Link to="/" className="text-brand-600 hover:underline">
            {t('privacy.backToApp')}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
