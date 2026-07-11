import { test, expect } from '@playwright/test';

/**
 * Mobile-viewport smoke checks for the AppShell rollout. These run only via
 * `npm run test:e2e` (project: browser-mobile) — non-gating, since CI's
 * deploy gate is the `api` project only. They deliberately avoid auth so
 * they stay cheap and don't race with the serial auth-flow specs.
 */
test.describe('Mobile shell smoke (browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('/login renders with no horizontal overflow', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('/login has no guest tab bar (unauthenticated, no shell chrome)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('guest-tab-bar')).toHaveCount(0);
  });

  test('Protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear()).catch(() => undefined);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-email')).toBeVisible();
  });
});
