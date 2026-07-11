import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import AppShell from '../../components/layout/AppShell';
import { useAuthStore } from '../../store/authStore';
import { FiMail, FiLock, FiUser, FiPhone, FiEye, FiEyeOff } from 'react-icons/fi';
import { Button, FormField, Input } from '../../components/ui';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const { confirmPassword: _confirmPassword, ...registerData } = data;
      await register(registerData);
      navigate('/dashboard');
    } catch (_error) {
      // Error is handled in the store
    }
  };

  return (
    <AppShell variant="minimal">
      <div className="w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-display text-ink">
            Create your account
          </h2>
          <p className="mt-2 text-center text-body text-ink-muted">
            Or{' '}
            <Link
              to="/login"
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('auth.firstName')} htmlFor="firstName" required error={errors.firstName?.message}>
                <Input
                  {...registerField('firstName')}
                  type="text"
                  leadingIcon={<FiUser className="h-5 w-5" />}
                  placeholder={t('profile.firstNamePlaceholder')}
                />
              </FormField>

              <FormField label={t('auth.lastName')} htmlFor="lastName" required error={errors.lastName?.message}>
                <Input
                  {...registerField('lastName')}
                  type="text"
                  leadingIcon={<FiUser className="h-5 w-5" />}
                  placeholder={t('profile.lastNamePlaceholder')}
                />
              </FormField>
            </div>

            <FormField label={t('auth.email')} htmlFor="email" required error={errors.email?.message}>
              <Input
                {...registerField('email')}
                type="email"
                autoComplete="email"
                leadingIcon={<FiMail className="h-5 w-5" />}
                placeholder="john@example.com"
              />
            </FormField>

            <FormField
              label={`${t('auth.phone')} (${t('common.optional')})`}
              htmlFor="phone"
              error={errors.phone?.message}
            >
              <Input
                {...registerField('phone')}
                type="tel"
                leadingIcon={<FiPhone className="h-5 w-5" />}
                placeholder="+1 (555) 123-4567"
              />
            </FormField>

            <FormField label={t('auth.password')} htmlFor="password" required error={errors.password?.message}>
              <Input
                {...registerField('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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
                placeholder="••••••••"
              />
            </FormField>

            <FormField
              label={t('auth.confirmPassword')}
              htmlFor="confirmPassword"
              required
              error={errors.confirmPassword?.message}
            >
              <Input
                {...registerField('confirmPassword')}
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                leadingIcon={<FiLock className="h-5 w-5" />}
                trailingSlot={
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="flex h-11 w-11 items-center justify-center text-ink-faint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-lg"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <FiEyeOff className="h-5 w-5" />
                    ) : (
                      <FiEye className="h-5 w-5" />
                    )}
                  </button>
                }
                placeholder="••••••••"
              />
            </FormField>
          </div>

          <Button type="submit" loading={isLoading} className="w-full">
            {t('auth.createAccount')}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
