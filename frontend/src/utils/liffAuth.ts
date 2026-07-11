import { useAuthStore } from '../store/authStore';
import { logger } from './logger';

// The LINE in-app browser always carries "Line/" in its user agent. We use
// this as a cheap pre-check so the LIFF SDK is never even downloaded for
// normal web visitors — the web code path must stay byte-for-byte
// unchanged.
const LINE_UA_PATTERN = /Line\//i;

export function isLikelyLineInAppBrowser(): boolean {
  return LINE_UA_PATTERN.test(navigator.userAgent);
}

/**
 * Silent LIFF auto-login, called once from App bootstrap.
 *
 * Inside the LINE in-app browser (opened from an OA rich menu) this
 * initialises the LIFF SDK, obtains the LINE ID token, and exchanges it at
 * `POST /api/auth/liff` for a normal session — silently enrolling
 * first-time guests. Outside LINE, or without a configured `VITE_LIFF_ID`,
 * it is a no-op and the SDK is never loaded.
 *
 * Returns whether the user ended up authenticated. Never throws.
 */
export async function initLiffAutoLogin(): Promise<boolean> {
  const liffId = import.meta.env.VITE_LIFF_ID;
  if (!liffId || !isLikelyLineInAppBrowser()) {
    return false;
  }

  try {
    // Dynamic import keeps @line/liff out of the main bundle for the web.
    const { default: liff } = await import('@line/liff');
    await liff.init({ liffId });

    if (!liff.isInClient()) {
      // Opened in an external browser (e.g. a shared LIFF URL) — let the
      // normal web login flow handle it.
      return false;
    }

    const store = useAuthStore.getState();
    if (store.isAuthenticated && store.accessToken) {
      return true;
    }

    const idToken = liff.getIDToken();
    if (!idToken) {
      // Absent or consumed ID token — re-run LINE login inside the client
      // to mint a fresh one. This redirects and re-enters the app.
      liff.login({ redirectUri: window.location.href });
      return false;
    }

    return await store.liffLogin(idToken);
  } catch (error: unknown) {
    logger.warn(
      'LIFF auto-login skipped:',
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
