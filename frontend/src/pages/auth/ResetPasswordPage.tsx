import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/authService';
import toast from 'react-hot-toast';
import { FiMail, FiLock } from 'react-icons/fi';
import { Button, FormField, Input } from '../../components/ui';

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RequestFormData = z.infer<typeof requestSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const requestForm = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onRequestSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    try {
      await authService.resetPasswordRequest(data.email);
      setIsSubmitted(true);
      toast.success('Password reset link sent to your email');
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage ?? 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  const onResetSubmit = async (data: ResetFormData) => {
    if (!token) {return;}

    setIsLoading(true);
    try {
      await authService.resetPassword(token, data.password);
      toast.success('Password reset successfully');
      window.location.href = '/login';
    } catch (error) {
      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage ?? 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-display text-ink">
              Reset your password
            </h2>
            <p className="mt-2 text-center text-body text-ink-muted">
              Enter your new password below
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={resetForm.handleSubmit(onResetSubmit)}>
            <div className="space-y-4">
              <FormField
                label={t('auth.newPassword')}
                htmlFor="password"
                required
                error={resetForm.formState.errors.password?.message}
              >
                <Input
                  {...resetForm.register('password')}
                  type="password"
                  leadingIcon={<FiLock className="h-5 w-5" />}
                  placeholder="••••••••"
                />
              </FormField>

              <FormField
                label={t('auth.confirmNewPassword')}
                htmlFor="confirmPassword"
                required
                error={resetForm.formState.errors.confirmPassword?.message}
              >
                <Input
                  {...resetForm.register('confirmPassword')}
                  type="password"
                  leadingIcon={<FiLock className="h-5 w-5" />}
                  placeholder="••••••••"
                />
              </FormField>
            </div>

            <Button type="submit" loading={isLoading} className="w-full">
              Reset password
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-display text-ink">
            Forgot your password?
          </h2>
          <p className="mt-2 text-center text-body text-ink-muted">
            Or{' '}
            <Link
              to="/login"
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              return to sign in
            </Link>
          </p>
        </div>

        {isSubmitted ? (
          <div className="rounded-lg bg-success-50 p-4">
            <h3 className="text-caption font-semibold text-success-700">Check your email</h3>
            <div className="mt-2 text-caption text-success-700">
              <p>
                If an account exists with that email address, we&apos;ve sent a password reset
                link. Please check your email and follow the instructions.
              </p>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={requestForm.handleSubmit(onRequestSubmit)}>
            <FormField
              label={t('auth.email')}
              htmlFor="email"
              required
              error={requestForm.formState.errors.email?.message}
            >
              <Input
                {...requestForm.register('email')}
                type="email"
                autoComplete="email"
                leadingIcon={<FiMail className="h-5 w-5" />}
                placeholder="john@example.com"
              />
            </FormField>

            <Button type="submit" loading={isLoading} className="w-full">
              {t('auth.sendResetLink')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
