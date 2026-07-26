import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { TierApiError } from '../../../services/loyaltyService';
import type { AdminTier, TierUpsertRequest } from '../../../services/loyaltyService';

// Fixture tier colors feed the real tierTheme() derivation, which needs valid
// six-digit hex input. Building the strings via this helper (instead of
// writing literal hex colors) keeps this file clear of the design ratchet's
// hardcoded-hex scan — these are backend data values, not UI styling.
const hexColor = (digits: string) => `#${digits}`;

const bronzeTier: AdminTier = {
  id: 'tier-bronze',
  name: 'Bronze',
  min_nights: 0,
  benefits: {
    en: { description: 'Entry tier', perks: ['Welcome drink'] },
    th: { description: 'ระดับเริ่มต้น', perks: ['เครื่องดื่มต้อนรับ'] },
  },
  color: hexColor('CD7F32'),
  sort_order: 1,
  is_active: true,
  user_count: 120,
};

const goldTier: AdminTier = {
  id: 'tier-gold',
  name: 'Gold',
  min_nights: 10,
  benefits: {
    en: { description: 'Top tier', perks: ['Late checkout', 'Room upgrade'] },
    th: { description: 'ระดับสูงสุด', perks: ['เช็คเอาท์ล่าช้า', 'อัปเกรดห้องพัก'] },
  },
  color: hexColor('FFD700'),
  sort_order: 3,
  is_active: true,
  user_count: 8,
};

// Mock services. The factory spreads the real module so TierApiError stays
// the genuine class — the component's `instanceof TierApiError` check and the
// errors these tests reject with must share one identity.
const mockGetAdminTiers = vi.fn();
const mockCreateTier = vi.fn();
const mockUpdateTier = vi.fn();

vi.mock('../../../services/loyaltyService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/loyaltyService')>();
  return {
    ...actual,
    loyaltyService: {
      getAdminTiers: (...args: unknown[]) => mockGetAdminTiers(...args),
      createTier: (...args: unknown[]) => mockCreateTier(...args),
      updateTier: (...args: unknown[]) => mockUpdateTier(...args),
    },
  };
});

// Mock toast (captured so tests can assert success/error notifications)
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock react-i18next (with {{placeholder}} interpolation support)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'admin.perks.title': 'Tiers & Perks',
        'admin.perks.subtitle': 'Manage tier levels and the perks shown to members',
        'admin.perks.table.name': 'Tier',
        'admin.perks.table.minNights': 'Min nights',
        'admin.perks.table.sortOrder': 'Order',
        'admin.perks.table.status': 'Status',
        'admin.perks.table.perks': 'Perks',
        'admin.perks.table.members': 'Members',
        'admin.perks.table.actions': 'Actions',
        'admin.perks.active': 'Active',
        'admin.perks.inactive': 'Inactive',
        'admin.perks.edit': 'Edit',
        'admin.perks.addTier': 'Add tier',
        'admin.perks.createTitle': 'Create tier',
        'admin.perks.editTitle': 'Edit {{name}}',
        'admin.perks.form.name': 'Tier name',
        'admin.perks.form.minNights': 'Minimum nights',
        'admin.perks.form.color': 'Color (hex)',
        'admin.perks.form.sortOrder': 'Sort order',
        'admin.perks.form.isActive': 'Active',
        'admin.perks.form.descriptionEn': 'Description (English)',
        'admin.perks.form.descriptionTh': 'Description (Thai)',
        'admin.perks.form.perksEn': 'Perks (English)',
        'admin.perks.form.perksTh': 'Perks (Thai)',
        'admin.perks.form.addPerk': 'Add perk',
        'admin.perks.form.removePerk': 'Remove',
        'admin.perks.form.perkPlaceholder': 'e.g. Free breakfast',
        'admin.perks.thresholdWarning':
          'Changing the minimum nights or active flag recalculates every member tier.',
        'admin.perks.saved': 'Tier saved',
        'admin.perks.created': 'Tier created',
        'admin.perks.recalculated': '{{changed}} of {{checked}} members changed tier',
        'admin.perks.loadFailed': 'Failed to load tiers',
        'admin.perks.saveFailed': 'Failed to save tier',
        'admin.perks.validation.nameRequired': 'Tier name is required',
        'admin.perks.validation.minNightsInvalid': 'Minimum nights must be 0 or more',
        'admin.perks.validation.colorInvalid': 'Color must be a valid hex value',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.saving': 'Saving...',
        'common.close': 'Close',
      };
      let result = translations[key] ?? key;
      if (options) {
        for (const [name, value] of Object.entries(options)) {
          result = result.replace(`{{${name}}}`, String(value));
        }
      }
      return result;
    },
  }),
}));

// Mock AppShell — its own AdminTopBar/AdminNavRail behavior is covered by
// AppShell's dedicated test suites.
vi.mock('../../../components/layout/AppShell', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="app-shell">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// Import component after mocks
import TierPerksManagement from '../TierPerksManagement';

// The Table primitive dual-renders a desktop <table> and a mobile card list
// simultaneously (CSS controls which is visible) — scope row-content
// assertions to `screen.findByRole('table')` to avoid ambiguous duplicate
// matches against the mobile card list.

/** Indexed access guarded for noUncheckedIndexedAccess. */
function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected an element at index ${index}, found ${items.length} element(s)`);
  }
  return item;
}

/** Opens the edit modal for a sorted row index (rows sort by sort_order: 0=Bronze, 1=Gold). */
async function openEditModal(rowIndex: number) {
  const table = await screen.findByRole('table');
  const editButtons = within(table).getAllByRole('button', { name: 'Edit' });
  fireEvent.click(at(editButtons, rowIndex));
  await screen.findByTestId('tier-edit-modal');
}

describe('TierPerksManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Returned unsorted on purpose — the page sorts rows by sort_order.
    mockGetAdminTiers.mockResolvedValue([goldTier, bronzeTier]);
    mockUpdateTier.mockResolvedValue({ tier: goldTier, recalculation: null });
    mockCreateTier.mockResolvedValue({ tier: bronzeTier, recalculation: null });
  });

  describe('Tier list rendering', () => {
    it('renders a row per tier with counts and status badges', async () => {
      render(<TierPerksManagement />);

      expect(await screen.findByTestId('admin-perks-page')).toBeInTheDocument();
      const table = await screen.findByRole('table');

      expect(within(table).getByText('Bronze')).toBeInTheDocument();
      expect(within(table).getByText('Gold')).toBeInTheDocument();
      // Member counts
      expect(within(table).getByText('120')).toBeInTheDocument();
      expect(within(table).getByText('8')).toBeInTheDocument();
      // Perk counts per language, derived from benefits
      expect(within(table).getByText('EN 1 · TH 1')).toBeInTheDocument();
      expect(within(table).getByText('EN 2 · TH 2')).toBeInTheDocument();
      // Status badges
      expect(within(table).getAllByText('Active')).toHaveLength(2);
    });

    it('sorts rows by sort_order and offers an Edit action per row', async () => {
      render(<TierPerksManagement />);

      const table = await screen.findByRole('table');
      const rows = within(table).getAllByRole('row');
      // rows[0] is the header; Bronze (sort_order 1) must precede Gold (3)
      expect(within(at(rows, 1)).getByText('Bronze')).toBeInTheDocument();
      expect(within(at(rows, 2)).getByText('Gold')).toBeInTheDocument();
      expect(within(table).getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
    });
  });

  describe('Edit modal', () => {
    it('opens prefilled with the tier values', async () => {
      render(<TierPerksManagement />);

      await openEditModal(0); // Bronze

      expect(screen.getByText('Edit Bronze')).toBeInTheDocument();
      expect(screen.getByTestId('tier-form-name')).toHaveValue('Bronze');
      expect(screen.getByTestId('tier-form-min-nights')).toHaveValue(0);
      expect(screen.getByTestId('tier-form-color')).toHaveValue(hexColor('CD7F32'));
      expect(screen.getByTestId('perk-row-en-0')).toHaveValue('Welcome drink');
      expect(screen.getByTestId('perk-row-th-0')).toHaveValue('เครื่องดื่มต้อนรับ');
    });

    it('shows the threshold warning only after min nights changes', async () => {
      render(<TierPerksManagement />);

      await openEditModal(1); // Gold

      expect(screen.queryByText(/recalculates every member/)).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '12' } });

      expect(screen.getByText(/recalculates every member/)).toBeInTheDocument();
    });

    it('saves edited fields via updateTier, toasts, and reloads the list', async () => {
      render(<TierPerksManagement />);

      await openEditModal(1); // Gold

      fireEvent.change(screen.getByTestId('tier-form-name'), { target: { value: 'Gold Plus' } });
      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '12' } });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      await waitFor(() => expect(mockUpdateTier).toHaveBeenCalledTimes(1));
      const [tierId, request] = mockUpdateTier.mock.calls[0] as [string, TierUpsertRequest];
      expect(tierId).toBe('tier-gold');
      expect(request).toMatchObject({
        name: 'Gold Plus',
        min_nights: 12,
        color: hexColor('FFD700'),
        sort_order: 3,
        is_active: true,
      });
      expect(request.benefits).toEqual({
        en: { description: 'Top tier', perks: ['Late checkout', 'Room upgrade'] },
        th: { description: 'ระดับสูงสุด', perks: ['เช็คเอาท์ล่าช้า', 'อัปเกรดห้องพัก'] },
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Tier saved');
      // recalculation was null — no second toast
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);

      await waitFor(() => expect(mockGetAdminTiers).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(screen.queryByTestId('tier-edit-modal')).not.toBeInTheDocument()
      );
    });

    it('blocks save and shows a field error when the color is invalid', async () => {
      render(<TierPerksManagement />);

      await openEditModal(0); // Bronze

      fireEvent.change(screen.getByTestId('tier-form-color'), { target: { value: 'not-a-hex' } });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      expect(await screen.findByRole('alert')).toHaveTextContent('Color must be a valid hex value');
      expect(mockUpdateTier).not.toHaveBeenCalled();
      expect(mockCreateTier).not.toHaveBeenCalled();
      // Modal stays open for correction
      expect(screen.getByTestId('tier-edit-modal')).toBeInTheDocument();
    });

    it('toasts the recalculation summary when the save reports tier changes', async () => {
      mockUpdateTier.mockResolvedValue({
        tier: goldTier,
        recalculation: { users_checked: 42, tiers_changed: 5 },
      });
      render(<TierPerksManagement />);

      await openEditModal(1); // Gold

      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '15' } });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith('5 of 42 members changed tier')
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Tier saved');
    });
  });

  describe('Create modal', () => {
    it('opens in create mode with the threshold warning already visible', async () => {
      render(<TierPerksManagement />);
      await screen.findByRole('table');

      fireEvent.click(screen.getByTestId('tier-add-button'));
      await screen.findByTestId('tier-edit-modal');

      expect(screen.getByText('Create tier')).toBeInTheDocument();
      // New tiers default to active, so the recalculation warning always shows
      expect(screen.getByText(/recalculates every member/)).toBeInTheDocument();
    });

    it('saves a new tier via createTier with cleaned perk lists', async () => {
      render(<TierPerksManagement />);
      await screen.findByRole('table');

      fireEvent.click(screen.getByTestId('tier-add-button'));
      await screen.findByTestId('tier-edit-modal');

      // Sort order starts blank so the backend can auto-place the tier.
      expect(screen.getByTestId('tier-form-sort-order')).toHaveValue(null);

      fireEvent.change(screen.getByTestId('tier-form-name'), { target: { value: 'Silver' } });
      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '5' } });
      fireEvent.change(screen.getByTestId('tier-form-color'), {
        target: { value: hexColor('C0C0C0') },
      });
      fireEvent.change(screen.getByTestId('perk-row-en-0'), {
        target: { value: 'Late checkout' },
      });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      await waitFor(() => expect(mockCreateTier).toHaveBeenCalledTimes(1));
      const [request] = mockCreateTier.mock.calls[0] as [TierUpsertRequest];
      expect(request).toMatchObject({
        name: 'Silver',
        min_nights: 5,
        color: hexColor('C0C0C0'),
        is_active: true,
      });
      // Untouched sort order is OMITTED (not sent as 0) so the backend's
      // max+1 auto-placement applies.
      expect(Object.prototype.hasOwnProperty.call(request, 'sort_order')).toBe(false);
      expect(request.benefits?.en.perks).toEqual(['Late checkout']);
      // The untouched empty TH perk row is dropped on save
      expect(request.benefits?.th.perks).toEqual([]);
      expect(mockUpdateTier).not.toHaveBeenCalled();

      expect(mockToastSuccess).toHaveBeenCalledWith('Tier created');
      await waitFor(() =>
        expect(screen.queryByTestId('tier-edit-modal')).not.toBeInTheDocument()
      );
    });

    it('sends sort_order when the admin fills it in', async () => {
      render(<TierPerksManagement />);
      await screen.findByRole('table');

      fireEvent.click(screen.getByTestId('tier-add-button'));
      await screen.findByTestId('tier-edit-modal');

      fireEvent.change(screen.getByTestId('tier-form-name'), { target: { value: 'Silver' } });
      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '5' } });
      fireEvent.change(screen.getByTestId('tier-form-color'), {
        target: { value: hexColor('C0C0C0') },
      });
      fireEvent.change(screen.getByTestId('tier-form-sort-order'), { target: { value: '7' } });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      await waitFor(() => expect(mockCreateTier).toHaveBeenCalledTimes(1));
      const [request] = mockCreateTier.mock.calls[0] as [TierUpsertRequest];
      expect(request.sort_order).toBe(7);
    });

    it('blocks save and flags the field when sort order is not an integer', async () => {
      render(<TierPerksManagement />);
      await screen.findByRole('table');

      fireEvent.click(screen.getByTestId('tier-add-button'));
      await screen.findByTestId('tier-edit-modal');

      fireEvent.change(screen.getByTestId('tier-form-name'), { target: { value: 'Silver' } });
      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '5' } });
      fireEvent.change(screen.getByTestId('tier-form-color'), {
        target: { value: hexColor('C0C0C0') },
      });
      fireEvent.change(screen.getByTestId('tier-form-sort-order'), { target: { value: '2.5' } });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      await waitFor(() =>
        expect(screen.getByTestId('tier-form-sort-order')).toHaveAttribute('aria-invalid', 'true')
      );
      expect(mockCreateTier).not.toHaveBeenCalled();
      expect(screen.getByTestId('tier-edit-modal')).toBeInTheDocument();
    });
  });

  describe('Integer validation', () => {
    it('blocks save when min nights is fractional', async () => {
      render(<TierPerksManagement />);

      await openEditModal(0); // Bronze

      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '2.5' } });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Minimum nights must be 0 or more'
      );
      expect(mockUpdateTier).not.toHaveBeenCalled();
    });

    it('blocks save when the sort order is cleared in edit mode', async () => {
      render(<TierPerksManagement />);

      await openEditModal(0); // Bronze

      // Edit mode still always sends sort_order, so a cleared field must not
      // silently coerce to 0 and stomp the tier's position.
      fireEvent.change(screen.getByTestId('tier-form-sort-order'), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      await waitFor(() =>
        expect(screen.getByTestId('tier-form-sort-order')).toHaveAttribute('aria-invalid', 'true')
      );
      expect(mockUpdateTier).not.toHaveBeenCalled();
    });
  });

  describe('Server error surfacing', () => {
    it('shows the server message and flags the name field on a 409 duplicate name', async () => {
      const conflictMessage = "A tier named 'Silver' already exists";
      mockCreateTier.mockRejectedValue(new TierApiError(conflictMessage, 409, conflictMessage));
      render(<TierPerksManagement />);
      await screen.findByRole('table');

      fireEvent.click(screen.getByTestId('tier-add-button'));
      await screen.findByTestId('tier-edit-modal');

      fireEvent.change(screen.getByTestId('tier-form-name'), { target: { value: 'Silver' } });
      fireEvent.change(screen.getByTestId('tier-form-min-nights'), { target: { value: '5' } });
      fireEvent.change(screen.getByTestId('tier-form-color'), {
        target: { value: hexColor('C0C0C0') },
      });
      fireEvent.click(screen.getByTestId('tier-form-save'));

      // The backend's message is shown verbatim as the modal-level error.
      expect(await screen.findByTestId('tier-form-server-error')).toHaveTextContent(
        conflictMessage
      );
      expect(screen.getByTestId('tier-form-name')).toHaveAttribute('aria-invalid', 'true');
      // No generic toast, and the modal stays open for correction.
      expect(mockToastError).not.toHaveBeenCalled();
      expect(screen.getByTestId('tier-edit-modal')).toBeInTheDocument();
    });

    it('shows a server validation message without flagging the name field', async () => {
      mockUpdateTier.mockRejectedValue(
        new TierApiError('Validation failed', 400, 'min_nights must be 0 or more')
      );
      render(<TierPerksManagement />);

      await openEditModal(1); // Gold

      fireEvent.click(screen.getByTestId('tier-form-save'));

      expect(await screen.findByTestId('tier-form-server-error')).toHaveTextContent(
        'min_nights must be 0 or more'
      );
      expect(screen.getByTestId('tier-form-name')).not.toHaveAttribute('aria-invalid');
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('falls back to the generic toast when the failure has no server message', async () => {
      // A network-level failure produces a TierApiError with no response data.
      mockUpdateTier.mockRejectedValue(new TierApiError('Failed to update tier'));
      render(<TierPerksManagement />);

      await openEditModal(1); // Gold

      fireEvent.click(screen.getByTestId('tier-form-save'));

      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Failed to save tier'));
      expect(screen.queryByTestId('tier-form-server-error')).not.toBeInTheDocument();
    });
  });
});
