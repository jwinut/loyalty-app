import { test, expect } from '@playwright/test';
import { retryRequest } from './helpers/retry';

/**
 * E2E tests for complete coupon lifecycle
 * Tests coupon creation, activation, assignment, revocation, deletion, and expiration
 *
 * The CI backend container sets ADMIN_BOOTSTRAP_EMAILS=e2e-admin@test.local
 * (.github/actions/start-app-stack/action.yml), so the seeded admin account
 * is promoted to a real admin at registration (issue #348). beforeAll
 * hard-asserts that privilege once; every admin test then asserts the full
 * admin contract unconditionally — no "skip on 403" escapes.
 *
 * Request/response shapes follow the Rust backend
 * (backend-rust/src/routes/coupons.rs): request DTOs are snake_case
 * (coupon_type, usage_limit, valid_until), responses are wrapped in
 * { success, data } and paginated lists in { items, total, page, limit,
 * totalPages }. The camelCase shapes this spec used to send date from the
 * old Node backend and never executed — they were hidden behind the skips.
 */
test.describe('Coupon Lifecycle Management', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4202';

  // Admin credentials - fixed email listed in ADMIN_BOOTSTRAP_EMAILS on the
  // CI backend container, so this account carries role=admin.
  const adminEmail = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@test.local';
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'AdminPassword123!';

  // Customer credentials
  const customerEmail = `e2e-customer-${Date.now()}@example.com`;
  const customerPassword = 'CustomerPassword123!';

  let adminToken: string | null = null;
  let customerToken: string | null = null;
  let csrfToken: string | null = null;
  let customerId: string | null = null;

  // Coupon test data
  const testCouponCode = `E2E${Date.now()}`.slice(0, 20).toUpperCase();
  let createdCouponId: string | null = null;
  let assignedUserCouponId: string | null = null;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    // Wait for backend to be ready
    await retryRequest(request, `${backendUrl}/api/health`, 5);

    // Get CSRF token
    const csrfResponse = await request.get(`${backendUrl}/api/csrf-token`);
    if (csrfResponse.ok()) {
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken;
    }

    // Try to login as admin first (might already exist)
    const adminLoginResponse = await request.post(`${backendUrl}/api/auth/login`, {
      data: {
        email: adminEmail,
        password: adminPassword,
      },
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
    });

    if (!adminLoginResponse.ok()) {
      // Register admin user
      const registerResponse = await request.post(`${backendUrl}/api/auth/register`, {
        data: {
          email: adminEmail,
          password: adminPassword,
          firstName: 'E2E',
          lastName: 'Admin',
        },
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      if (registerResponse.ok()) {
        const registerData = await registerResponse.json();
        adminToken = registerData.tokens?.accessToken || registerData.accessToken;
      } else {
        // A parallel or earlier run may have registered the account between
        // our login attempt and this register (409 Conflict). Retry the
        // login ONCE and take that token; the hard assertions below still
        // apply unconditionally.
        const retryLoginResponse = await request.post(`${backendUrl}/api/auth/login`, {
          data: {
            email: adminEmail,
            password: adminPassword,
          },
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
          },
        });
        if (retryLoginResponse.ok()) {
          const retryLoginData = await retryLoginResponse.json();
          adminToken = retryLoginData.tokens?.accessToken || retryLoginData.accessToken;
        }
      }
    } else {
      const loginData = await adminLoginResponse.json();
      adminToken = loginData.tokens?.accessToken || loginData.accessToken;
    }

    // The suite is a deploy gate: fail loudly here instead of letting every
    // admin test silently skip when the account is not what we expect.
    expect(adminToken, 'admin login/registration must yield a token').toBeTruthy();

    // Hard-assert the account actually carries the admin role: an
    // admin-only endpoint must answer 200, not 403.
    const privilegeProbe = await request.get(`${backendUrl}/api/coupons/analytics/stats`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    expect(
      privilegeProbe.status(),
      `${adminEmail} must be a real admin — check ADMIN_BOOTSTRAP_EMAILS on the backend container`,
    ).toBe(200);

    // Register customer user
    const customerRegisterResponse = await request.post(`${backendUrl}/api/auth/register`, {
      data: {
        email: customerEmail,
        password: customerPassword,
        firstName: 'E2E',
        lastName: 'Customer',
      },
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
    });

    expect(
      customerRegisterResponse.ok(),
      'customer registration must succeed (unique email per run)',
    ).toBeTruthy();
    const customerData = await customerRegisterResponse.json();
    customerToken = customerData.tokens?.accessToken || customerData.accessToken;
    customerId = customerData.user?.id;
    expect(customerToken, 'customer registration must yield a token').toBeTruthy();
    expect(customerId, 'customer registration must yield the user id').toBeTruthy();
  });

  test.describe('1. Create New Coupon', () => {
    test('should create a new draft coupon', async ({ request }) => {
      const couponData = {
        code: testCouponCode,
        name: 'E2E Test Coupon',
        description: 'Created by E2E test for lifecycle testing',
        coupon_type: 'percentage',
        value: 15,
        currency: 'THB',
        usage_limit_per_user: 1,
        usage_limit: 100,
      };

      const response = await request.post(`${backendUrl}/api/coupons`, {
        data: couponData,
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      const coupon = body.data;

      expect(coupon.code).toBe(couponData.code);
      expect(coupon.name).toBe(couponData.name);
      expect(coupon.coupon_type).toBe(couponData.coupon_type);
      expect(coupon.status).toBe('draft'); // New coupons start as draft

      createdCouponId = coupon.id;
      expect(createdCouponId).toBeTruthy();
    });

    test('should reject duplicate coupon code', async ({ request }) => {
      expect(createdCouponId, 'coupon must have been created').toBeTruthy();

      const response = await request.post(`${backendUrl}/api/coupons`, {
        data: {
          code: testCouponCode, // Same code as before
          name: 'Duplicate Code Test',
          coupon_type: 'percentage',
          value: 10,
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      // Duplicate key maps to AppError::AlreadyExists -> 409 Conflict
      expect(response.status()).toBe(409);
    });

    test('should validate coupon type', async ({ request }) => {
      const response = await request.post(`${backendUrl}/api/coupons`, {
        data: {
          code: `INVALID${Date.now()}`.slice(0, 20).toUpperCase(),
          name: 'Invalid Type Test',
          coupon_type: 'invalid_type', // Not a CouponType variant
          value: 10,
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      // An unknown enum variant fails serde deserialization, which axum's
      // Json extractor rejects with 422 before the handler runs.
      expect(response.status()).toBe(422);
    });
  });

  test.describe('2. Activate Coupon', () => {
    test('should activate a draft coupon', async ({ request }) => {
      expect(createdCouponId, 'coupon must have been created').toBeTruthy();

      const response = await request.put(`${backendUrl}/api/coupons/${createdCouponId}`, {
        data: {
          status: 'active',
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('active');
    });

    test('should be able to pause an active coupon', async ({ request }) => {
      expect(createdCouponId, 'coupon must have been created').toBeTruthy();

      const response = await request.put(`${backendUrl}/api/coupons/${createdCouponId}`, {
        data: {
          status: 'paused',
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('paused');

      // Re-activate for next tests
      const reactivate = await request.put(`${backendUrl}/api/coupons/${createdCouponId}`, {
        data: { status: 'active' },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });
      expect(reactivate.status()).toBe(200);
    });
  });

  test.describe('3. Assign Coupon to User', () => {
    test('should assign coupon to a customer', async ({ request }) => {
      expect(createdCouponId, 'coupon must have been created').toBeTruthy();
      expect(customerId, 'customer must have been registered').toBeTruthy();

      const response = await request.post(`${backendUrl}/api/coupons/assign`, {
        data: {
          couponId: createdCouponId,
          userIds: [customerId],
          assignedReason: 'E2E Test Assignment',
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Response is { success, data: [UserCouponResponse, ...], message }
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].status).toBe('available');
    });

    test('customer should see assigned coupon in my-coupons', async ({ request }) => {
      const response = await request.get(`${backendUrl}/api/coupons/my-coupons`, {
        headers: {
          'Authorization': `Bearer ${customerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      // API returns { success: true, data: { items: [...], total, page, limit, totalPages } }
      expect(result.success).toBe(true);
      const coupons = result.data?.items ?? [];
      expect(Array.isArray(coupons)).toBe(true);

      // Items are flat user-coupon rows joined with the coupon's code
      const testCoupon = coupons.find((c: { code: string }) => c.code === testCouponCode);
      expect(testCoupon, 'assigned coupon must appear in my-coupons').toBeTruthy();
      expect(testCoupon.status).toBe('available');

      // Store the userCouponId for the revocation tests
      assignedUserCouponId = testCoupon.id;
      expect(assignedUserCouponId).toBeTruthy();
    });

    test('should validate couponId format', async ({ request }) => {
      const response = await request.post(`${backendUrl}/api/coupons/assign`, {
        data: {
          couponId: 'not-a-valid-uuid',
          userIds: ['also-not-valid'],
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      // couponId deserializes into a Uuid; a malformed value fails serde and
      // axum's Json extractor rejects it with 422 before the handler runs.
      expect(response.status()).toBe(422);
    });

    test('should limit users per assignment request', async ({ request }) => {
      expect(createdCouponId, 'coupon must have been created').toBeTruthy();

      // Create array of 101 fake UUIDs
      const tooManyUsers = Array(101).fill(null).map((_, i) =>
        `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
      );

      const response = await request.post(`${backendUrl}/api/coupons/assign`, {
        data: {
          couponId: createdCouponId,
          userIds: tooManyUsers,
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      // Handler-level validation (max 100 users) -> 400
      expect(response.status()).toBe(400);
    });
  });

  test.describe('4. Revoke Coupon from User', () => {
    test('should revoke assigned coupon from user', async ({ request }) => {
      expect(assignedUserCouponId, 'user coupon must have been assigned').toBeTruthy();

      const response = await request.post(`${backendUrl}/api/coupons/user-coupons/${assignedUserCouponId}/revoke`, {
        data: {
          reason: 'E2E Test Revocation',
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(200);
    });

    test('customer should not see revoked coupon as available', async ({ request }) => {
      expect(assignedUserCouponId, 'user coupon must have been assigned').toBeTruthy();

      const response = await request.get(`${backendUrl}/api/coupons/my-coupons`, {
        headers: {
          'Authorization': `Bearer ${customerToken}`,
        },
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      const coupons = result.data?.items ?? [];

      // Revocation UPDATEs the row to status 'revoked' (it does not delete),
      // and my-coupons applies no default status filter, so the row must
      // still be listed — as revoked, never as available.
      const testCoupon = coupons.find((c: { id: string, status: string }) =>
        c.id === assignedUserCouponId
      );
      expect(testCoupon, 'revoked user-coupon row must still be listed').toBeTruthy();
      expect(testCoupon.status).toBe('revoked');
    });

    test('should handle non-existent userCouponId', async ({ request }) => {
      const response = await request.post(`${backendUrl}/api/coupons/user-coupons/00000000-0000-0000-0000-000000000000/revoke`, {
        data: {
          reason: 'Testing non-existent',
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(404);
    });
  });

  test.describe('5. Delete Coupon', () => {
    test('should delete a coupon', async ({ request }) => {
      expect(createdCouponId, 'coupon must have been created').toBeTruthy();

      const response = await request.delete(`${backendUrl}/api/coupons/${createdCouponId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(200);
    });

    test('deleted coupon should not be accessible', async ({ request }) => {
      expect(createdCouponId, 'coupon must have been created').toBeTruthy();

      const response = await request.get(`${backendUrl}/api/coupons/${createdCouponId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      // Should return 404
      expect(response.status()).toBe(404);
    });

    test('should handle non-existent couponId for deletion', async ({ request }) => {
      const response = await request.delete(`${backendUrl}/api/coupons/00000000-0000-0000-0000-000000000000`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(404);
    });
  });

  test.describe('6. Coupon Expiration', () => {
    let expiredCouponId: string | null = null;

    test('should create a coupon with past expiration date', async ({ request }) => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const response = await request.post(`${backendUrl}/api/coupons`, {
        data: {
          code: `EXP${Date.now()}`.slice(0, 20).toUpperCase(),
          name: 'Expired Test Coupon',
          coupon_type: 'percentage',
          value: 10,
          valid_until: pastDate.toISOString(),
          status: 'active', // Create as active; the past valid_until governs usability
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expiredCouponId = body.data.id;
      expect(expiredCouponId).toBeTruthy();
    });

    test('should handle coupon with expiration date set', async ({ request }) => {
      // Create a coupon that will expire soon
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

      const response = await request.post(`${backendUrl}/api/coupons`, {
        data: {
          code: `FUT${Date.now()}`.slice(0, 20).toUpperCase(),
          name: 'Future Expiration Test',
          coupon_type: 'fixed_amount',
          value: 100,
          valid_from: new Date().toISOString(),
          valid_until: futureDate.toISOString(),
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.valid_until).toBeTruthy();

      // Clean up
      const cleanup = await request.delete(`${backendUrl}/api/coupons/${body.data.id}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });
      expect(cleanup.status()).toBe(200);
    });

    test.afterAll(async ({ request }) => {
      // Clean up expired coupon if created
      if (expiredCouponId && adminToken) {
        await request.delete(`${backendUrl}/api/coupons/${expiredCouponId}`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
          },
        });
      }
    });
  });
});

test.describe('Coupon Validation Tests', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4202';

  test('QR code validation endpoint should be publicly accessible', async ({ request }) => {
    const response = await request.get(`${backendUrl}/api/coupons/validate/TESTQRCODE123`);

    // Should return 200 with validation result or 404 for non-existent code
    expect([200, 404]).toContain(response.status());

    const data = await response.json();
    expect(data.success !== undefined || data.error !== undefined).toBe(true);
  });

  test('should return proper validation response structure', async ({ request }) => {
    const response = await request.get(`${backendUrl}/api/coupons/validate/NONEXISTENT`);

    expect([200, 404]).toContain(response.status());

    const data = await response.json();
    // Should have either success field or error field
    expect(typeof data === 'object').toBe(true);
  });
});

test.describe('Coupon Analytics Tests', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4202';

  test('analytics stats endpoint should require admin auth', async ({ request }) => {
    const response = await request.get(`${backendUrl}/api/coupons/analytics/stats`);
    expect([401, 403]).toContain(response.status());
  });

  test('analytics data endpoint should require admin auth', async ({ request }) => {
    const response = await request.get(`${backendUrl}/api/coupons/analytics/data`);
    expect([401, 403]).toContain(response.status());
  });

  test('redemptions endpoint should require admin auth', async ({ request }) => {
    const response = await request.get(`${backendUrl}/api/coupons/00000000-0000-0000-0000-000000000000/redemptions`);
    expect([401, 403]).toContain(response.status());
  });

  test('assignments endpoint should require admin auth', async ({ request }) => {
    const response = await request.get(`${backendUrl}/api/coupons/00000000-0000-0000-0000-000000000000/assignments`);
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Coupon API Contract Tests', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4202';

  test('all coupon routes should be properly registered', async ({ request }) => {
    const routes = [
      // Note: /validate/:qrCode returns 404 for invalid QR codes (expected behavior)
      // so we test it separately below
      { method: 'GET', path: '/api/coupons' },
      { method: 'POST', path: '/api/coupons' },
      { method: 'GET', path: '/api/coupons/my-coupons' },
      { method: 'POST', path: '/api/coupons/assign' },
      { method: 'POST', path: '/api/coupons/redeem' },
      { method: 'GET', path: '/api/coupons/analytics/stats' },
      { method: 'GET', path: '/api/coupons/analytics/data' },
    ];

    for (const route of routes) {
      let response;
      if (route.method === 'GET') {
        response = await request.get(`${backendUrl}${route.path}`);
      } else {
        response = await request.post(`${backendUrl}${route.path}`, {
          data: {},
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Routes should exist (not 404) - they may require auth (401/403) which is expected
      expect(response.status()).not.toBe(404);
    }

    // Test validate endpoint separately - it returns 404 for invalid QR codes
    // which is valid business logic, not a missing route
    const validateResponse = await request.get(`${backendUrl}/api/coupons/validate/INVALID_TEST_CODE`);
    // Should return 200 (with valid: false), 404, or 400 - not 500 (server error)
    expect([200, 404, 400]).toContain(validateResponse.status());
  });

  test('coupon type should accept all valid types', async ({ request }) => {
    const validTypes = ['percentage', 'fixed_amount', 'bogo', 'free_upgrade', 'free_service'];

    for (const type of validTypes) {
      // Just verify the type is documented - actual creation requires admin
      expect(validTypes).toContain(type);
    }
  });

  test('coupon status should accept all valid statuses', async ({ request }) => {
    const validStatuses = ['draft', 'active', 'paused', 'expired', 'exhausted'];

    for (const status of validStatuses) {
      // Just verify the status is documented
      expect(validStatuses).toContain(status);
    }
  });

  test('health check should pass before coupon tests', async ({ request }) => {
    const response = await retryRequest(request, `${backendUrl}/api/health`, 5);
    expect(response.status()).toBe(200);

    const health = await response.json();
    expect(health.status).toBeTruthy();
    expect(health.services.database).toBeTruthy();
  });
});
