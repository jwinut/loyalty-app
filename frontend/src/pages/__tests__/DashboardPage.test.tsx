import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tierTheme } from '../../utils/tierTheme';

/**
 * DashboardPage tests — the guest landing page. Playwright depends on
 * dashboard-tier/dashboard-points/dashboard-loading plus the nav-* card
 * testids, so those are asserted directly rather than through snapshot.
 */

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockGetUserLoyaltyStatus = vi.fn();
const mockGetPointsHistory = vi.fn();
vi.mock('../../services/loyaltyService', () => ({
  loyaltyService: {
    getUserLoyaltyStatus: (...args: unknown[]) => mockGetUserLoyaltyStatus(...args),
    getPointsHistory: (...args: unknown[]) => mockGetPointsHistory(...args),
  },
}));

let mockUser: Record<string, unknown> | null = null;
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: mockUser }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'dashboard.title' && options?.name !== undefined) {
        return `Welcome Back, ${options.name}`;
      }
      return key;
    },
  }),
}));

vi.mock('../../components/layout/AppShell', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('../../components/loyalty/LoyaltyCarousel', () => ({
  default: () => <div data-testid="loyalty-carousel" />,
}));

import DashboardPage from '../DashboardPage';

// tierTheme resolves purely from tier_name for known tiers (see tierTheme.ts),
// so this fixture deliberately avoids a hex literal — the raw backend color is
// irrelevant once the name matches a curated tier.
const loyaltyStatus = {
  user_id: 'user-1',
  current_points: 1500,
  total_nights: 5,
  tier_name: 'Silver',
  tier_color: 'silver-metal-not-used-by-curated-lookup',
  tier_benefits: {},
  tier_level: 2,
  progress_percentage: 53.3,
  next_tier_nights: 10,
  next_tier_name: 'Gold',
  nights_to_next_tier: 5,
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', firstName: 'Test', role: 'customer' };
    mockGetUserLoyaltyStatus.mockResolvedValue(loyaltyStatus);
    mockGetPointsHistory.mockResolvedValue({ transactions: [] });
  });

  it('shows the loading skeleton grid while loyalty status is pending', () => {
    mockGetUserLoyaltyStatus.mockReturnValue(new Promise(() => {}));

    render(<DashboardPage />, { wrapper });

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
  });

  it('renders the tier and points using the AA-safe tier theme', async () => {
    render(<DashboardPage />, { wrapper });

    const tierChip = await screen.findByTestId('dashboard-tier');
    expect(tierChip).toHaveTextContent('Silver');

    const theme = tierTheme(loyaltyStatus.tier_name, loyaltyStatus.tier_color);
    expect(tierChip).toHaveStyle({ backgroundColor: theme.tintBg, color: theme.onTint });

    const pointsValue = await screen.findByTestId('dashboard-points');
    expect(pointsValue).toHaveTextContent('1,500');
  });

  it('renders every guest nav card with its stable testid', async () => {
    render(<DashboardPage />, { wrapper });

    await screen.findByTestId('dashboard-tier');

    for (const testId of ['nav-member-card', 'nav-profile', 'nav-booking', 'nav-my-bookings']) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });

  it('does not render the admin management grid for a customer', async () => {
    render(<DashboardPage />, { wrapper });

    await screen.findByTestId('dashboard-tier');

    expect(screen.queryByTestId('nav-admin-room-types')).not.toBeInTheDocument();
  });

  it('renders the admin management grid for an admin user', async () => {
    mockUser = { id: 'admin-1', firstName: 'Admin', role: 'admin' };

    render(<DashboardPage />, { wrapper });

    await screen.findByTestId('dashboard-tier');

    for (const testId of [
      'nav-admin-room-types',
      'nav-admin-rooms',
      'nav-admin-availability',
      'nav-admin-booking-management',
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });

  it('renders the welcome message section', async () => {
    render(<DashboardPage />, { wrapper });

    expect(await screen.findByText('dashboard.welcomeMessage')).toBeInTheDocument();
  });
});
