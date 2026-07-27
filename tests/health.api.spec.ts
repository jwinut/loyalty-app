import { test, expect } from '@playwright/test';
import { retryRequest } from './helpers/retry';

test.describe('Application Health Checks', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4202';

  test('Backend health endpoint should respond', async ({ request }) => {
    // Retry connection attempts with exponential backoff
    const response = await retryRequest(request, `${backendUrl}/api/health`, 5);

    expect(response.status()).toBe(200);

    const health = await response.json();
    expect(health.status).toBeTruthy();
    expect(health.timestamp).toBeTruthy();
  });

  /**
   * Issue #345 — prove a deploy shipped the intended commit.
   *
   * `revision` is the commit SHA baked into the image at build time
   * (`ARG GIT_SHA` / `ENV GIT_SHA` in both Dockerfiles). `version` cannot do
   * this job: it is CARGO_PKG_VERSION, identical across commits.
   *
   * In CI this spec runs against the image that was just built and pushed for
   * the current commit, with EXPECTED_REVISION set to that SHA — so a green
   * run here means the image really carries its own identity, proven BEFORE
   * anything is deployed. The SHA is deliberately NOT injected into the
   * container by start-app-stack; if it were, this would assert its own input.
   *
   * Locally (or against a stack built without the build-arg) the value is
   * "unknown", which is still non-empty — the deploy verifiers treat that as
   * "cannot tell" and warn rather than fail.
   */
  test('Backend health endpoint should expose the image revision', async ({ request }) => {
    const response = await retryRequest(request, `${backendUrl}/api/health`, 5);

    const health = await response.json();
    expect(typeof health.revision).toBe('string');
    expect(health.revision.length).toBeGreaterThan(0);

    const expectedRevision = process.env.EXPECTED_REVISION;
    if (expectedRevision) {
      expect(
        health.revision,
        `The running image reports revision "${health.revision}" but this run built ` +
          `"${expectedRevision}". Either GIT_SHA was not baked into the image, or the ` +
          `stack is running a different build than the one under test.`
      ).toBe(expectedRevision);
    }
  });

  test('API endpoints should be accessible', async ({ request }) => {
    // Test that API endpoints are reachable (but may require auth)
    const endpoints = [
      '/api/health',
      '/api/auth/health', // This should return 404 or method not allowed, not connection error
    ];

    for (const endpoint of endpoints) {
      const response = await retryRequest(request, `${backendUrl}${endpoint}`, 3);
      // Should get a response (not a connection error), even if 404 or 405
      expect(response.status()).not.toBe(0); // 0 means connection failed
    }
  });
});

test.describe('OAuth Integration Tests', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4202';

  test('OAuth endpoints should be accessible', async ({ request }) => {
    // Test that OAuth endpoints don't return connection errors
    const oauthEndpoints = [
      '/api/oauth/google',
      '/api/oauth/line'
    ];

    for (const endpoint of oauthEndpoints) {
      // Disable redirects so we only validate the backend response and don't follow external providers
      const response = await retryRequest(request, `${backendUrl}${endpoint}`, 3, {
        maxRedirects: 0
      });
      // Should get a redirect or OAuth flow, not connection error
      // 303 is used by Axum's Redirect::to() (See Other)
      expect([200, 302, 303, 401, 403]).toContain(response.status());
    }
  });
});
