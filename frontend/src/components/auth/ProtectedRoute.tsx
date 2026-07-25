import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../store/authStore';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { logger } from '../../utils/logger';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'customer' | 'staff' | 'admin' | 'super_admin';
  redirectTo?: string;
}

// Cloudflare Access silently authenticates HF Managers for this prefix only
// (see `authStore.cfExchangeLogin`). Guest/customer routes never match this
// and so never trigger the exchange attempt below.
const ADMIN_PATH_PREFIX = '/admin';

export default function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isLoading = useAuthStore((state) => state.isLoading);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  // Read defensively: older test mocks (predating this feature) supply a
  // partial store shape without `cfExchangeLogin`, so this can come back
  // `undefined` — handled below by skipping the exchange attempt.
  const cfExchangeLogin = useAuthStore((state) => state.cfExchangeLogin);
  const location = useLocation();

  const isAdminPath = location.pathname.startsWith(ADMIN_PATH_PREFIX);

  // Cloudflare Access admin auto-login: on an /admin* path with no session
  // at all, try the silent cf-exchange once before falling back to the
  // login-form redirect. This is the ONLY place that exchange is triggered
  // — never on the login page or any customer/guest route. A guest or
  // employee hitting an /admin* path simply gets a 401/403 from the
  // exchange and falls straight through to the normal redirect, same as
  // today.
  const [cfExchangeAttempted, setCfExchangeAttempted] = useState(false);
  const cfExchangeInFlight = useRef(false);

  useEffect(() => {
    if (!isAdminPath || isAuthenticated || cfExchangeAttempted || cfExchangeInFlight.current) {
      return;
    }

    if (typeof cfExchangeLogin !== 'function') {
      setCfExchangeAttempted(true);
      return;
    }

    cfExchangeInFlight.current = true;
    cfExchangeLogin()
      .catch(() => false)
      .finally(() => {
        cfExchangeInFlight.current = false;
        setCfExchangeAttempted(true);
      });
  }, [isAdminPath, isAuthenticated, cfExchangeAttempted, cfExchangeLogin]);

  // Verify authentication on mount and when tokens change
  useEffect(() => {
    const verifyAuth = async () => {
      // Only check if we think we're authenticated but don't have valid data
      if (isAuthenticated && (!user || !accessToken)) {
        try {
          await checkAuthStatus();
        } catch (error) {
          logger.warn('Auth verification failed in ProtectedRoute:', error);
          // Auth state will be cleared by checkAuthStatus on failure
        }
      }
    };

    verifyAuth();
  }, [isAuthenticated, user, accessToken, checkAuthStatus]);

  // Show loading while auth is being verified, or while an /admin* path is
  // still waiting on the silent Cloudflare Access exchange — without this,
  // an unauthenticated admin would flash the login redirect before the
  // exchange even resolves.
  const isAwaitingCfExchange = isAdminPath && !isAuthenticated && !cfExchangeAttempted;
  if (isLoading || isAwaitingCfExchange) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600" />
          <p className="mt-4 text-stone-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login with return URL
  if (!isAuthenticated || !user || !accessToken) {
    // Save the attempted location for redirect after login
    const returnUrl = location.pathname + location.search;
    return <Navigate to={`${redirectTo}?returnUrl=${encodeURIComponent(returnUrl)}`} replace />;
  }

  // Check role requirements if specified
  if (requiredRole) {
    const roleHierarchy = {
      'customer': 0,
      'staff': 1,
      'admin': 2,
      'super_admin': 3
    };

    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    // User doesn't have sufficient role
    if (userRoleLevel < requiredRoleLevel) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-stone-900">Access Denied</h3>
            <p className="mt-2 text-sm text-stone-500">
              You need {requiredRole.replace('_', ' ')} privileges to access this page.
            </p>
            <button
              onClick={() => window.history.back()}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // User is authenticated and has required role (if any)
  return <>{children}</>;
}