import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';

/**
 * PDPA privacy notice. Publicly reachable (no auth) — linked from the
 * footer and the OA rich menus. Documents the friendship-as-opt-in
 * position: membership operates as contract; the LINE OA friendship is the
 * messaging opt-in and blocking the OA is the opt-out.
 */
export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-6">
          <h1 className="text-2xl font-bold text-stone-900">{t('privacy.title')}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-2">
            {t('privacy.whatWeStoreTitle')}
          </h2>
          <p className="text-stone-700">{t('privacy.whatWeStoreBody')}</p>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-2">
            {t('privacy.whyTitle')}
          </h2>
          <p className="text-stone-700">{t('privacy.whyBody')}</p>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-2">
            {t('privacy.messagesTitle')}
          </h2>
          <p className="text-stone-700">{t('privacy.messagesBody')}</p>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-2">
            {t('privacy.contactTitle')}
          </h2>
          <p className="text-stone-700">{t('privacy.contactBody')}</p>
        </section>

        <div className="text-center">
          <Link to="/" className="text-brand-600 hover:underline">
            {t('privacy.backToApp')}
          </Link>
        </div>
      </main>
    </div>
  );
}
