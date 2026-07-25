// React import removed as it's not needed in newer React versions
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FiMail } from 'react-icons/fi';

interface EmailDisplayProps {
  email?: string | null;
  linkToProfile?: boolean;
  className?: string;
  showIcon?: boolean;
}

export default function EmailDisplay({ 
  email, 
  linkToProfile = true, 
  className = '',
  showIcon = false 
}: EmailDisplayProps) {
  const { t } = useTranslation();

  if (!email) {
    return linkToProfile ? (
      <Link 
        to="/profile?tab=settings"
        className={`text-brand-600 hover:text-brand-800 underline inline-flex items-center ${className}`}
      >
        {showIcon && <FiMail className="w-4 h-4 mr-1" />}
        {t('profile.addEmailAddress')}
      </Link>
    ) : (
      <span className={`text-stone-400 italic ${className}`}>
        {t('profile.noEmailProvided')}
      </span>
    );
  }

  return (
    <span className={`text-stone-900 inline-flex items-center ${className}`}>
      {showIcon && <FiMail className="w-4 h-4 mr-1 text-stone-500" />}
      {email}
    </span>
  );
}