import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * MemberCardPage tests — the desk-scannable member QR (the physical
 * handshake that creates the member ↔ PMS guest-profile Link).
 */

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockQrToDataURL = vi.fn();
vi.mock('qrcode', () => ({
  default: {
    toDataURL: (...args: unknown[]) => mockQrToDataURL(...args),
  },
}));

const mockGetLoyaltyStatus = vi.fn();
vi.mock('../../services/loyaltyService', () => ({
  loyaltyService: {
    getUserLoyaltyStatus: (...args: unknown[]) => mockGetLoyaltyStatus(...args),
  },
}));

const mockGetProfile = vi.fn();
vi.mock('../../services/userService', () => ({
  userService: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
  },
}));

let mockUser: Record<string, unknown> | null = null;
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: mockUser }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

import MemberCardPage from '../MemberCardPage';

describe('MemberCardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Guest',
      membershipId: 'HF-000123',
    };
    mockGetLoyaltyStatus.mockResolvedValue({
      tier_name: 'Gold',
      tier_color: '#b45309',
    });
    mockQrToDataURL.mockResolvedValue('data:image/png;base64,MOCKQR');
  });

  it('renders the membership ID as a QR code plus readable ID and tier', async () => {
    render(<MemberCardPage />, { wrapper });

    // QR generated from the raw membership ID (what the desk scans).
    await waitFor(() => {
      expect(mockQrToDataURL).toHaveBeenCalledWith('HF-000123', expect.any(Object));
    });

    await waitFor(() => {
      const qr = screen.getByTestId('member-qr') as HTMLImageElement;
      expect(qr.src).toContain('data:image/png');
    });

    expect(screen.getByTestId('member-id')).toHaveTextContent('HF-000123');

    await waitFor(() => {
      expect(screen.getByTestId('member-card-tier')).toHaveTextContent('Gold');
    });

    // membershipId came from the auth store — no profile fetch needed.
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('falls back to the profile when the auth store has no membershipId', async () => {
    mockUser = { id: 'user-1', firstName: 'Test' };
    mockGetProfile.mockResolvedValue({ membershipId: 'HF-000999' });

    render(<MemberCardPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('member-id')).toHaveTextContent('HF-000999');
    });
  });

  it('shows a hint instead of a broken QR when no membership ID exists anywhere', async () => {
    mockUser = { id: 'user-1', firstName: 'Test' };
    mockGetProfile.mockResolvedValue({});

    render(<MemberCardPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('member-id-missing')).toBeInTheDocument();
    });
    expect(mockQrToDataURL).not.toHaveBeenCalled();
  });
});
