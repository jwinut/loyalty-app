import { test, expect } from '@playwright/test';
import { retryRequest } from './helpers/retry';

/**
 * E2E tests for admin tier management (/api/loyalty/admin/tiers)
 *
 * Runs against a SHARED stack, so it never mutates the four real tiers:
 * when it can act as admin it works on ONE fixed-name INACTIVE probe tier
 * with create-if-missing-else-reuse semantics (repeated runs converge to a
 * single row instead of accumulating uniquely-named tiers), updates only
 * that tier, and verifies it is visible in the admin list but hidden from
 * the public /api/loyalty/tiers endpoint.
 *
 * Admin capability is probed once in beforeAll: the CI stack seeds
 * e2e-admin@test.local through the public register endpoint, which may or
 * may not be elevated to the admin role depending on the stack's admin
 * provisioning. Instead of skipping when it is not elevated (this suite is
 * a deploy gate — silent skips would hide regressions), every mutation
 * test asserts the OTHER contract in that case: the endpoint must enforce
 * 403 for the non-elevated account. Both branches are real assertions
 * about the deployed backend.
 */
test.describe('Admin Tier Management', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4202';

  // Admin credentials - fixed email seeded by the CI app-stack action
  const adminEmail = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@test.local';
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'AdminPassword123!';

  // Customer credentials (unique per run)
  const customerEmail = `e2e-tier-customer-${Date.now()}@example.com`;
  const customerPassword = 'CustomerPassword123!';

  // FIXED name: reruns on the shared stack reuse the same probe row
  // (create-if-missing-else-reuse) instead of accumulating tiers.
  const tierName = 'E2E Perks Probe (inactive)';

  let adminToken: string | null = null;
  let adminIsPrivileged = false;
  let customerToken: string | null = null;
  let csrfToken: string | null = null;
  let createdTierId: string | null = null;

  const initialBenefits = {
    en: { description: 'E2E created tier', perks: ['E2E perk one', 'E2E perk two'] },
    th: { description: 'ระดับที่สร้างโดย E2E', perks: ['สิทธิพิเศษหนึ่ง', 'สิทธิพิเศษสอง'] },
  };

  const updatedBenefits = {
    en: { description: 'E2E updated tier', perks: ['E2E updated perk'] },
    th: { description: 'ระดับที่แก้ไขโดย E2E', perks: ['สิทธิพิเศษที่แก้ไข'] },
  };

  const authHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
  });

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

    // Login as the seeded admin account, register it on first run
    const adminLoginResponse = await request.post(`${backendUrl}/api/auth/login`, {
      data: { email: adminEmail, password: adminPassword },
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
    });

    if (adminLoginResponse.ok()) {
      const loginData = await adminLoginResponse.json();
      adminToken = loginData.tokens?.accessToken || loginData.accessToken;
    } else {
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
      }
    }

    // Probe whether the account actually carries the admin role on this
    // stack (depends on the stack's admin provisioning).
    if (adminToken) {
      const probe = await request.get(`${backendUrl}/api/loyalty/admin/tiers`, {
        headers: authHeaders(adminToken),
      });
      adminIsPrivileged = probe.status() === 200;
    }

    // Register a regular customer for the 403 checks
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
    if (customerRegisterResponse.ok()) {
      const customerData = await customerRegisterResponse.json();
      customerToken = customerData.tokens?.accessToken || customerData.accessToken;
    }
  });

  test.describe('1. Access Control', () => {
    test('admin tier endpoints should require authentication', async ({ request }) => {
      const listResponse = await request.get(`${backendUrl}/api/loyalty/admin/tiers`);
      expect(listResponse.status()).toBe(401);

      const createResponse = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
        data: { name: 'Nope', min_nights: 1, color: '#123456' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(createResponse.status()).toBe(401);

      const updateResponse = await request.put(
        `${backendUrl}/api/loyalty/admin/tiers/00000000-0000-0000-0000-000000000000`,
        {
          data: { min_nights: 5 },
          headers: { 'Content-Type': 'application/json' },
        },
      );
      expect(updateResponse.status()).toBe(401);
    });

    test('admin tier endpoints should reject regular users', async ({ request }) => {
      expect(customerToken, 'customer registration must succeed').toBeTruthy();

      const listResponse = await request.get(`${backendUrl}/api/loyalty/admin/tiers`, {
        headers: authHeaders(customerToken as string),
      });
      expect(listResponse.status()).toBe(403);

      const createResponse = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
        data: { name: 'Nope', min_nights: 1, color: '#123456' },
        headers: authHeaders(customerToken as string),
      });
      expect(createResponse.status()).toBe(403);

      const updateResponse = await request.put(
        `${backendUrl}/api/loyalty/admin/tiers/00000000-0000-0000-0000-000000000000`,
        {
          data: { min_nights: 5 },
          headers: authHeaders(customerToken as string),
        },
      );
      expect(updateResponse.status()).toBe(403);
    });
  });

  test.describe('2. Create Inactive Tier', () => {
    test('create or reuse the probe tier: full contract as admin, 403 otherwise', async ({ request }) => {
      expect(adminToken, 'admin account login/registration must succeed').toBeTruthy();

      if (!adminIsPrivileged) {
        // Stack without admin provisioning: RBAC must still hold.
        const response = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
          data: {
            name: tierName,
            min_nights: 9999,
            color: '#123456',
            is_active: false,
            benefits: initialBenefits,
          },
          headers: authHeaders(adminToken as string),
        });
        expect(response.status()).toBe(403);
        return;
      }

      // Create-if-missing-else-reuse: look the fixed name up first so
      // repeated runs on a shared stack converge to one probe row.
      const listResponse = await request.get(`${backendUrl}/api/loyalty/admin/tiers`, {
        headers: authHeaders(adminToken as string),
      });
      expect(listResponse.status()).toBe(200);
      const listBody = await listResponse.json();
      expect(Array.isArray(listBody.data)).toBe(true);
      const existing = listBody.data.find((t: { name: string }) => t.name === tierName);

      if (existing) {
        // A previous run created it. Assert the invariants this suite
        // never mutates, then reset the mutable fields (benefits/color)
        // so every run starts from the same fixture state.
        createdTierId = existing.id;
        expect(createdTierId).toBeTruthy();
        expect(existing.is_active).toBe(false);
        expect(existing.min_nights).toBe(9999);
        expect(existing.user_count).toBe(0);

        const reset = await request.put(
          `${backendUrl}/api/loyalty/admin/tiers/${createdTierId}`,
          {
            data: { benefits: initialBenefits, color: '#123456' },
            headers: authHeaders(adminToken as string),
          },
        );
        expect(reset.status()).toBe(200);
        const resetBody = await reset.json();
        expect(resetBody.success).toBe(true);
        expect(resetBody.data.tier.benefits).toEqual(initialBenefits);
        expect(resetBody.data.tier.color).toBe('#123456');
        // Neither min_nights nor is_active changed -> no recalculation
        expect(resetBody.data.recalculation).toBeNull();
        return;
      }

      const response = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
        data: {
          name: tierName,
          min_nights: 9999,
          color: '#123456',
          is_active: false,
          benefits: initialBenefits,
        },
        headers: authHeaders(adminToken as string),
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.tier.name).toBe(tierName);
      expect(body.data.tier.min_nights).toBe(9999);
      expect(body.data.tier.is_active).toBe(false);
      expect(body.data.tier.user_count).toBe(0);
      expect(body.data.tier.benefits).toEqual(initialBenefits);
      // Inactive tier creation must NOT trigger a member recalculation
      expect(body.data.recalculation).toBeNull();

      createdTierId = body.data.tier.id;
      expect(createdTierId).toBeTruthy();
    });

    test('invalid tier payloads: 400 as admin, 403 otherwise', async ({ request }) => {
      expect(adminToken, 'admin account login/registration must succeed').toBeTruthy();
      const rejectedStatus = adminIsPrivileged ? 400 : 403;

      // Invalid color
      const badColor = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
        data: { name: `E2E Bad Color ${Date.now()}`, min_nights: 1, color: 'red', is_active: false },
        headers: authHeaders(adminToken as string),
      });
      expect(badColor.status()).toBe(rejectedStatus);

      // Negative min_nights
      const badNights = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
        data: { name: `E2E Bad Nights ${Date.now()}`, min_nights: -1, color: '#123456', is_active: false },
        headers: authHeaders(adminToken as string),
      });
      expect(badNights.status()).toBe(rejectedStatus);

      // Legacy flat benefits shape must be rejected
      const badBenefits = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
        data: {
          name: `E2E Bad Benefits ${Date.now()}`,
          min_nights: 1,
          color: '#123456',
          is_active: false,
          benefits: { description: 'flat', perks: ['x'] },
        },
        headers: authHeaders(adminToken as string),
      });
      expect(badBenefits.status()).toBe(rejectedStatus);
    });

    test('duplicate tier name: 409 as admin, 403 otherwise', async ({ request }) => {
      expect(adminToken, 'admin account login/registration must succeed').toBeTruthy();

      const response = await request.post(`${backendUrl}/api/loyalty/admin/tiers`, {
        data: { name: tierName, min_nights: 9999, color: '#123456', is_active: false },
        headers: authHeaders(adminToken as string),
      });

      if (!adminIsPrivileged) {
        expect(response.status()).toBe(403);
        return;
      }

      expect(createdTierId, 'tier must have been created').toBeTruthy();
      expect(response.status()).toBe(409);
    });
  });

  test.describe('3. Update the Created Tier', () => {
    test('update benefits and color: full contract as admin, 403 otherwise', async ({ request }) => {
      expect(adminToken, 'admin account login/registration must succeed').toBeTruthy();

      if (!adminIsPrivileged) {
        const response = await request.put(
          `${backendUrl}/api/loyalty/admin/tiers/00000000-0000-0000-0000-000000000000`,
          {
            data: { benefits: updatedBenefits, color: '#654321' },
            headers: authHeaders(adminToken as string),
          },
        );
        expect(response.status()).toBe(403);
        return;
      }

      expect(createdTierId, 'tier must have been created').toBeTruthy();
      const response = await request.put(
        `${backendUrl}/api/loyalty/admin/tiers/${createdTierId}`,
        {
          data: { benefits: updatedBenefits, color: '#654321' },
          headers: authHeaders(adminToken as string),
        },
      );
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.tier.id).toBe(createdTierId);
      expect(body.data.tier.color).toBe('#654321');
      expect(body.data.tier.benefits).toEqual(updatedBenefits);
      expect(body.data.tier.is_active).toBe(false);
      // Neither min_nights nor is_active changed -> no recalculation
      expect(body.data.recalculation).toBeNull();
    });

    test('unknown tier id: 404 as admin, 403 otherwise', async ({ request }) => {
      expect(adminToken, 'admin account login/registration must succeed').toBeTruthy();

      const response = await request.put(
        `${backendUrl}/api/loyalty/admin/tiers/00000000-0000-0000-0000-000000000000`,
        {
          data: { min_nights: 1 },
          headers: authHeaders(adminToken as string),
        },
      );
      expect(response.status()).toBe(adminIsPrivileged ? 404 : 403);
    });
  });

  test.describe('4. Visibility', () => {
    test('admin tier list: includes the inactive tier as admin, 403 otherwise', async ({ request }) => {
      expect(adminToken, 'admin account login/registration must succeed').toBeTruthy();

      const response = await request.get(`${backendUrl}/api/loyalty/admin/tiers`, {
        headers: authHeaders(adminToken as string),
      });

      if (!adminIsPrivileged) {
        expect(response.status()).toBe(403);
        return;
      }

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      expect(createdTierId, 'tier must have been created').toBeTruthy();
      const created = body.data.find((t: { id: string }) => t.id === createdTierId);
      expect(created, 'created tier must appear in the admin list').toBeTruthy();
      expect(created.is_active).toBe(false);
      expect(created.user_count).toBe(0);
      expect(created.benefits).toEqual(updatedBenefits);
    });

    test('public tiers endpoint should only list active tiers', async ({ request }) => {
      // Public endpoint: no auth required
      const response = await retryRequest(request, `${backendUrl}/api/loyalty/tiers`, 3);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      // Every publicly listed tier is active — inactive tiers never leak
      for (const tier of body.data) {
        expect(tier.is_active).toBe(true);
      }

      // The tier this run created (when admin-capable) must not leak
      if (createdTierId) {
        const leaked = body.data.find((t: { id: string }) => t.id === createdTierId);
        expect(leaked, 'inactive tier must not leak into the public list').toBeFalsy();
      }
      const leakedByName = body.data.find((t: { name: string }) => t.name === tierName);
      expect(leakedByName, 'inactive tier name must not leak into the public list').toBeFalsy();
    });
  });
});
