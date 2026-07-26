import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { tierTheme } from '../../utils/tierTheme';

/**
 * TierBenefitsPage tests — the public Marriott-style member-benefits page
 * (/benefits). Renders for logged-out visitors; authenticated members get
 * their current tier highlighted without the page ever blocking on the
 * status call.
 *
 * NOTE: tier fixtures deliberately use an empty-string color (tierTheme
 * resolves it to the default theme) — this file is not on the design
 * ratchet's hex-exemption list, so no literal hex values may appear here.
 */

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const mockGetTiers = vi.fn();
const mockGetLoyaltyStatus = vi.fn();
vi.mock('../../services/loyaltyService', () => ({
  loyaltyService: {
    getTiers: (...args: unknown[]) => mockGetTiers(...args),
    getUserLoyaltyStatus: (...args: unknown[]) => mockGetLoyaltyStatus(...args),
  },
}));

let mockIsAuthenticated = false;
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

// t() echoes the key (plus any {{nights}} argument) so assertions pin the
// exact translation keys; language is mutable per test for the th path.
let mockLanguage = 'en';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params && 'nights' in params ? `${key}:${String(params.nights)}` : key,
    i18n: {
      get language() {
        return mockLanguage;
      },
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

import TierBenefitsPage from '../TierBenefitsPage';

// Deliberately NOT in sort_order to prove the page sorts, with bilingual
// benefits payloads plus one legacy flat (pre-i18n) row.
const mockTiers = [
  {
    id: 'tier-gold',
    name: 'Gold',
    min_points: 0,
    min_nights: 10,
    benefits: {
      en: {
        description: 'Gold, in English',
        perks: ['Room upgrade', 'Late checkout', 'Welcome drink'],
      },
      th: { description: 'Gold, in Thai', perks: ['Thai gold perk'] },
    },
    color: '',
    sort_order: 3,
    is_active: true,
  },
  {
    id: 'tier-bronze',
    name: 'Bronze',
    min_points: 0,
    min_nights: 0,
    benefits: {
      en: { description: 'Bronze, in English', perks: ['Member rates'] },
      th: { description: 'Bronze, in Thai', perks: ['Thai bronze perk'] },
    },
    color: '',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'tier-silver',
    name: 'Silver',
    min_points: 0,
    min_nights: 1,
    // Legacy flat shape — resolveTierBenefits must still render it.
    benefits: { description: 'Silver, legacy flat', perks: ['Legacy silver perk'] },
    color: '',
    sort_order: 2,
    is_active: true,
  },
];

describe('TierBenefitsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockLanguage = 'en';
    mockGetTiers.mockResolvedValue(mockTiers);
    mockGetLoyaltyStatus.mockResolvedValue({ tier_name: 'Gold', tier_color: '' });
  });

  it('renders one card per tier, ordered by sort_order', async () => {
    render(<TierBenefitsPage />, { wrapper });

    const cards = await waitFor(() => {
      const found = screen.getAllByTestId('benefit-tier-card');
      expect(found).toHaveLength(3);
      return found;
    });

    expect(screen.getByTestId('benefits-page')).toBeInTheDocument();
    expect(cards.map((card) => card.getAttribute('data-tier'))).toEqual([
      'bronze',
      'silver',
      'gold',
    ]);
  });

  it('shows tier name, threshold line, description, and the full perk list', async () => {
    render(<TierBenefitsPage />, { wrapper });

    await screen.findAllByTestId('benefit-tier-card');

    // Thresholds: base tier vs nights-gated tiers.
    expect(screen.getByText('tierBenefits.baseTier')).toBeInTheDocument();
    expect(screen.getByText('tierBenefits.nightsRequired:1')).toBeInTheDocument();
    expect(screen.getByText('tierBenefits.nightsRequired:10')).toBeInTheDocument();

    // English descriptions and every perk (no truncation on this page).
    expect(screen.getByText('Gold, in English')).toBeInTheDocument();
    expect(screen.getByText('Room upgrade')).toBeInTheDocument();
    expect(screen.getByText('Late checkout')).toBeInTheDocument();
    expect(screen.getByText('Welcome drink')).toBeInTheDocument();

    // Legacy flat rows keep rendering through the resolver.
    expect(screen.getByText('Silver, legacy flat')).toBeInTheDocument();
    expect(screen.getByText('Legacy silver perk')).toBeInTheDocument();
  });

  it('renders the Thai benefits content for a Thai UI', async () => {
    mockLanguage = 'th';

    render(<TierBenefitsPage />, { wrapper });

    await screen.findAllByTestId('benefit-tier-card');

    expect(screen.getByText('Gold, in Thai')).toBeInTheDocument();
    expect(screen.getByText('Thai gold perk')).toBeInTheDocument();
    expect(screen.queryByText('Gold, in English')).not.toBeInTheDocument();
  });

  it('colors each card through tierTheme, never the raw tier color', async () => {
    render(<TierBenefitsPage />, { wrapper });

    const cards = await screen.findAllByTestId('benefit-tier-card');
    const goldCard = cards.find((card) => card.getAttribute('data-tier') === 'gold');
    expect(goldCard).toHaveStyle({ borderLeftColor: tierTheme('Gold', '').accent });
  });

  it('offers a sign-in prompt (and no tier highlight) to logged-out visitors', async () => {
    render(<TierBenefitsPage />, { wrapper });

    await screen.findAllByTestId('benefit-tier-card');

    const signInLink = screen.getByTestId('benefits-signin-link');
    expect(signInLink).toHaveAttribute('href', '/login');
    expect(signInLink).toHaveTextContent('tierBenefits.signInPrompt');
    expect(screen.queryByTestId('current-tier-badge')).not.toBeInTheDocument();
    // The member-status endpoint requires a JWT — never called logged-out.
    expect(mockGetLoyaltyStatus).not.toHaveBeenCalled();
  });

  it("highlights the authenticated member's current tier with a badge", async () => {
    mockIsAuthenticated = true;

    render(<TierBenefitsPage />, { wrapper });

    await screen.findAllByTestId('benefit-tier-card');

    const badge = await screen.findByTestId('current-tier-badge');
    expect(badge).toHaveTextContent('tierBenefits.yourTier');
    // The badge sits inside the member's own tier card (Gold).
    expect(badge.closest('[data-tier]')).toHaveAttribute('data-tier', 'gold');
    expect(screen.queryByTestId('benefits-signin-link')).not.toBeInTheDocument();
  });

  it('still renders the tier grid when the (non-blocking) status call fails', async () => {
    mockIsAuthenticated = true;
    mockGetLoyaltyStatus.mockRejectedValue(new Error('unauthorized'));

    render(<TierBenefitsPage />, { wrapper });

    const cards = await screen.findAllByTestId('benefit-tier-card');
    expect(cards).toHaveLength(3);
    expect(screen.queryByTestId('current-tier-badge')).not.toBeInTheDocument();
  });

  it('shows skeletons while the tiers are loading', () => {
    mockGetTiers.mockReturnValue(new Promise(() => undefined));

    render(<TierBenefitsPage />, { wrapper });

    expect(screen.getByTestId('benefits-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('benefit-tier-card')).not.toBeInTheDocument();
  });

  it('shows the load-failed state with a retry button that refetches', async () => {
    mockGetTiers
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(mockTiers);

    render(<TierBenefitsPage />, { wrapper });

    expect(await screen.findByText('tierBenefits.loadFailed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'tierBenefits.retry' }));

    const cards = await screen.findAllByTestId('benefit-tier-card');
    expect(cards).toHaveLength(3);
    expect(mockGetTiers).toHaveBeenCalledTimes(2);
  });
});
