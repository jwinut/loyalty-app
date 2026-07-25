import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../store/authStore';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import GoogleLoginButton from '../../components/auth/GoogleLoginButton';
import LineLoginButton from '../../components/auth/LineLoginButton';
import { notify } from '../../utils/notificationManager';
import { useTranslation } from 'react-i18next';
import { Button, FormField, Input } from '../../components/ui';
import AppShell from '../../components/layout/AppShell';

type LoginFormData = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export default function LoginPage() {
  const { t } = useTranslation();

  const loginSchema = z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(1, t('auth.passwordRequired')),
    rememberMe: z.boolean().default(false),
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [showPassword, setShowPassword] = useState(false);


  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'google_not_configured') {
      notify.error('Google login is not configured. Please use email login.');
    } else if (error === 'line_not_configured') {
      notify.error('LINE login is not configured. Please use email login.');
    } else if (error === 'oauth_failed') {
      notify.error('Social login failed. Please try again.');
    } else if (error === 'oauth_error') {
      notify.error('An error occurred during social login. Please try again.');
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema) as never,
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password, data.rememberMe);

      // Check for returnUrl in query params
      const returnUrl = searchParams.get('returnUrl');
      if (returnUrl) {
        // Validate the return URL to prevent open redirect vulnerabilities
        const isValidReturnUrl = returnUrl.startsWith('/') && !returnUrl.startsWith('//');
        navigate(isValidReturnUrl ? returnUrl : '/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (_error) {
      // Error is handled in the store
    }
  };

  return (
    <AppShell variant="minimal">
      <div className="w-full space-y-8">
        <div>
          <h2 className="text-center text-display text-ink">
            {t('auth.signIn')}
          </h2>
          <p className="mt-2 text-center text-body text-ink-muted">
            {t('common.or')}{' '}
            <Link
              to="/register"
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormField label={t('auth.email')} htmlFor="email" required error={errors.email?.message}>
            <Input
              {...register('email')}
              type="email"
              autoComplete="email"
              data-testid="login-email"
              leadingIcon={<FiMail className="h-5 w-5" />}
              placeholder={t('auth.email')}
            />
          </FormField>

          <FormField label={t('auth.password')} htmlFor="password" required error={errors.password?.message}>
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              data-testid="login-password"
              leadingIcon={<FiLock className="h-5 w-5" />}
              trailingSlot={
                <button
                  type="button"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="flex h-11 w-11 items-center justify-center text-ink-faint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-lg"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5" />
                  ) : (
                    <FiEye className="h-5 w-5" />
                  )}
                </button>
              }
              placeholder={t('auth.password')}
            />
          </FormField>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                {...register('rememberMe')}
                id="rememberMe"
                type="checkbox"
                className="h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600"
              />
              <label htmlFor="rememberMe" className="ml-2 text-caption text-ink">
                {t('auth.rememberMe')}
              </label>
            </div>
            <div className="text-caption">
              <Link
                to="/reset-password"
                className="font-semibold text-brand-600 hover:text-brand-700"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </div>

          <Button type="submit" loading={isLoading} className="w-full" data-testid="login-submit">
            {t('common.login')}
          </Button>
        </form>

        {/* Social Login Section */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-hairline" />
            </div>
            <div className="relative flex justify-center text-caption">
              <span className="px-2 bg-surface-page text-ink-muted">{t('auth.continueWith')}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <GoogleLoginButton />
            <LineLoginButton />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
