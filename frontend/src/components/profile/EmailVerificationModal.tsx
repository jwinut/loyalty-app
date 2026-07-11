import React, { useRef, useState, useEffect } from 'react';
import { FiMail, FiRefreshCw, FiCheck } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../ui';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  newEmail: string;
  onVerified: (email: string) => void;
  isRegistration?: boolean;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  onClose,
  newEmail,
  onVerified,
  isRegistration: _isRegistration = false,
}) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const verifyMutation = useMutation({
    mutationFn: async (_data: { code: string }) => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust email verification endpoints are implemented
      throw new Error('Email verification is temporarily unavailable');
    },
    onSuccess: () => {
      onVerified(newEmail);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Verification failed');
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      // Backend endpoint missing. Tracked in docs/admin-backend-gaps.md.
      // TODO: Replace with REST service when Rust email verification endpoints are implemented
      throw new Error('Email verification is temporarily unavailable');
    },
    onSuccess: () => {
      setResendSuccess(true);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to resend code');
      setResendSuccess(false);
    },
  });

  // Clear resend success message after 3 seconds
  useEffect(() => {
    if (resendSuccess) {
      const timer = setTimeout(() => setResendSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [resendSuccess]);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError(null);
      setResendSuccess(false);
    }
  }, [isOpen]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Auto-insert dash after 4 characters
    if (value.length > 4) {
      value = value.slice(0, 4) + '-' + value.slice(4, 8);
    }

    setCode(value);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate format
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setError(t('profile.invalidCodeFormat', 'Please enter a valid code (XXXX-XXXX)'));
      return;
    }

    verifyMutation.mutate({ code });
  };

  const handleResend = () => {
    setResendSuccess(false);
    resendMutation.mutate();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      initialFocusRef={codeInputRef}
      title={
        <span className="flex items-center gap-2">
          <FiMail className="text-brand-500" />
          {t('profile.verifyEmail', 'Verify Email')}
        </span>
      }
    >
      <form onSubmit={handleSubmit} data-testid="email-verification-modal">
        <p className="text-stone-600 mb-4">
          {t('profile.verificationCodeSent', 'A verification code has been sent to:')}
        </p>
        <p className="font-semibold text-stone-900 mb-6 break-all">{newEmail}</p>

        <div className="mb-4">
          <label htmlFor="verification-code" className="block text-sm font-semibold text-stone-700 mb-2">
            {t('profile.enterCode', 'Enter verification code')}
          </label>
          <input
            ref={codeInputRef}
            id="verification-code"
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="XXXX-XXXX"
            maxLength={9}
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            data-testid="verification-code-input"
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={verifyMutation.isPending || code.length < 9}
          className="w-full py-3 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="verify-button"
        >
          {verifyMutation.isPending ? t('common.verifying', 'Verifying...') : t('profile.verifyCode', 'Verify Code')}
        </button>

        <div className="mt-4 text-center">
          {resendSuccess ? (
            <div className="text-green-600 text-sm flex items-center justify-center gap-1" data-testid="resend-success">
              <FiCheck size={14} />
              {t('profile.codeResent', 'New code sent!')}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendMutation.isPending}
              className="text-brand-600 hover:text-brand-800 disabled:text-stone-400 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-1 mx-auto"
              data-testid="resend-code-button"
            >
              <FiRefreshCw className={resendMutation.isPending ? 'animate-spin' : ''} size={14} />
              {t('profile.resendCode', 'Resend code')}
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-stone-500 text-center">
          {t('profile.codeExpiry', "Code expires in 1 hour. Check your spam folder if you don't see it.")}
        </p>
      </form>
    </Modal>
  );
};

export default EmailVerificationModal;
