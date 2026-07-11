/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test file uses non-null assertions for DOM element access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveyRewardHistoryComponent from '../SurveyRewardHistory';
import { surveyService } from '../../../services/surveyService';
import { SurveyRewardHistory } from '../../../types/survey';
import toast from 'react-hot-toast';

// Mock dependencies
const mockTranslate = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'surveys.rewardHistory.title': 'Reward History',
    'surveys.rewardHistory.description': 'View all coupon rewards awarded for this survey',
    'surveys.rewardHistory.searchPlaceholder': 'Search by email, name, coupon code or name...',
    'surveys.rewardHistory.noRewardsAwarded': 'No rewards have been awarded yet',
    'surveys.rewardHistory.couponsWillAppear': 'Coupons awarded to users will appear here',
    'surveys.rewardHistory.noRewardsMatch': 'No rewards match your search',
    'surveys.rewardHistory.tryAdjustingSearch': 'Try adjusting your search terms',
    'surveys.rewardHistory.awarded': 'Awarded',
    'surveys.rewardHistory.viewDetails': 'View Details',
    'surveys.rewardHistory.page': 'Page',
    'surveys.rewardHistory.of': 'of',
    'surveys.rewardHistory.previous': 'Previous',
    'surveys.rewardHistory.next': 'Next',
    'surveys.rewardHistory.couponColumn': 'Coupon',
    'surveys.rewardHistory.userColumn': 'User',
    'surveys.stats.status': 'Status',
    'surveys.couponAssignment.completed': 'Completed',
    'surveys.couponAssignment.loadError': 'Failed to load reward history',
  };
  return translations[key] || key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

vi.mock('../../../services/surveyService', () => ({
  surveyService: {
    getSurveyRewardHistory: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('react-icons/fi', () => ({
  FiGift: () => <span data-testid="gift-icon">Gift</span>,
  FiUser: () => <span data-testid="user-icon">User</span>,
  FiCalendar: () => <span data-testid="calendar-icon">Calendar</span>,
  FiSearch: () => <span data-testid="search-icon">Search</span>,
}));

function getDesktopTable() {
  return screen.getByRole('table');
}

function getMobileContainer(container: HTMLElement) {
  return container.querySelector('[data-view="mobile"]') as HTMLElement;
}

describe('SurveyRewardHistory', () => {
  const mockRewards: SurveyRewardHistory[] = [
    {
      id: 'reward-1',
      survey_coupon_assignment_id: 'assignment-1',
      survey_response_id: 'response-1',
      user_coupon_id: 'user-coupon-1',
      user_id: 'user-1',
      awarded_at: '2024-01-15T10:30:00Z',
      award_condition_met: 'survey_completed',
      metadata: { survey_score: 85, completion_time: 120 },
      created_at: '2024-01-15T10:30:00Z',
      user_email: 'john.doe@example.com',
      user_name: 'John Doe',
      coupon_code: 'SURVEY100',
      coupon_name: '100 Baht Discount',
    },
    {
      id: 'reward-2',
      survey_coupon_assignment_id: 'assignment-1',
      survey_response_id: 'response-2',
      user_coupon_id: 'user-coupon-2',
      user_id: 'user-2',
      awarded_at: '2024-01-14T14:20:00Z',
      award_condition_met: 'survey_completed',
      metadata: {},
      created_at: '2024-01-14T14:20:00Z',
      user_email: 'jane.smith@example.com',
      user_name: 'Jane Smith',
      coupon_code: 'WELCOME50',
      coupon_name: '50% Off Next Stay',
    },
    {
      id: 'reward-3',
      survey_coupon_assignment_id: 'assignment-2',
      survey_response_id: 'response-3',
      user_coupon_id: 'user-coupon-3',
      user_id: 'user-3',
      awarded_at: '2024-01-13T09:15:00Z',
      award_condition_met: 'survey_completed',
      metadata: { feedback_rating: 5 },
      created_at: '2024-01-13T09:15:00Z',
      user_email: 'bob.johnson@example.com',
      user_name: 'Bob Johnson',
      coupon_code: 'FREEWIFI',
      coupon_name: 'Free WiFi Upgrade',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
      rewards: mockRewards,
      total: 3,
      totalPages: 1,
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Reward History')).toBeInTheDocument();
      });
    });

    it('should render without crashing', async () => {
      expect(() => render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />
      )).not.toThrow();

      // Wait for async operations to complete
      await waitFor(() => {
        expect(screen.getByText('Reward History')).toBeInTheDocument();
      });
    });

    it('should have proper heading', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const heading = screen.getByText('Reward History');
        expect(heading.tagName).toBe('H3');
      });
    });

    it('should display description', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('View all coupon rewards awarded for this survey')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show a loading skeleton on initial load', () => {
      const { container } = render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />
      );

      expect(container.querySelector('[data-loading="true"]')).toBeInTheDocument();
    });

    it('should display 3 mobile skeleton cards while loading', async () => {
      const { container } = render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />
      );

      const mobile = getMobileContainer(container);
      expect(mobile.querySelectorAll('[data-surface="card"]')).toHaveLength(3);

      await waitFor(() => {
        expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();
      });
    });

    it('should hide loading skeleton after data loads', async () => {
      const { container } = render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />
      );

      await waitFor(() => {
        expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();
      });
    });

    it('should load rewards on mount', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(surveyService.getSurveyRewardHistory).toHaveBeenCalledWith('survey-1', 1, 20);
      });
    });

    it('should only show skeleton on first page load', async () => {
      const { container, rerender } = render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />
      );

      await waitFor(() => {
        expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();
      });

      // Trigger page change
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      rerender(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      // Should not show skeleton when changing pages
      expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();
    });
  });

  describe('Empty State - No Rewards Ever', () => {
    it('should display empty state when no rewards', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: [],
        total: 0,
        totalPages: 0,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('No rewards have been awarded yet').length).toBeGreaterThan(0);
      });
    });

    it('should display empty state helper text', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: [],
        total: 0,
        totalPages: 0,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('Coupons awarded to users will appear here').length).toBeGreaterThan(0);
      });
    });

    it('should display gift icon in empty state', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: [],
        total: 0,
        totalPages: 0,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByTestId('gift-icon').length).toBeGreaterThan(0);
      });
    });

    it('should center empty state content', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: [],
        total: 0,
        totalPages: 0,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const emptyState = screen.getAllByText('No rewards have been awarded yet')[0]!.closest('div');
        expect(emptyState).toHaveClass('text-center');
      });
    });
  });

  describe('Empty Search Results', () => {
    it('should show different message when search returns no results', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'nonexistent@example.com');

      await waitFor(() => {
        expect(screen.getAllByText('No rewards match your search').length).toBeGreaterThan(0);
      });
    });

    it('should display adjust search helper text for empty search results', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'xyz123');

      await waitFor(() => {
        expect(screen.getAllByText('Try adjusting your search terms').length).toBeGreaterThan(0);
      });
    });

    it('should show pagination even when search returns no results', async () => {
      const user = userEvent.setup();
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        // Pagination should still be visible (it's based on total pages, not filtered results)
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
        expect(screen.getAllByText('No rewards match your search').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Reward List Display', () => {
    it('should display all rewards correctly', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
        expect(screen.getAllByText('WELCOME50 - 50% Off Next Stay').length).toBeGreaterThan(0);
        expect(screen.getAllByText('FREEWIFI - Free WiFi Upgrade').length).toBeGreaterThan(0);
      });
    });

    it('should display user information', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/jane\.smith@example\.com/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Bob Johnson/).length).toBeGreaterThan(0);
      });
    });

    it('should display Unknown User when user_name is null', async () => {
      const rewardsWithoutName: SurveyRewardHistory[] = [{
        ...mockRewards[0]!,
        user_name: undefined,
      }];

      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: rewardsWithoutName,
        total: 1,
        totalPages: 1,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/Unknown User/).length).toBeGreaterThan(0);
      });
    });

    it('should display award dates', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const awardedTexts = screen.getAllByText(/Awarded/);
        expect(awardedTexts.length).toBeGreaterThan(0);
      });
    });

    it('should display completed status badge', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        // One badge per reward per layout (desktop table + mobile card)
        const badges = screen.getAllByText('Completed');
        expect(badges.length).toBe(6);
        badges.forEach((badge) => expect(badge).toHaveAttribute('data-tone', 'success'));
      });
    });

    it('should display gift icons for each reward', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const giftIcons = screen.getAllByTestId('gift-icon');
        expect(giftIcons.length).toBeGreaterThan(0);
      });
    });

    it('should display user icons for each reward', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const userIcons = screen.getAllByTestId('user-icon');
        expect(userIcons.length).toBeGreaterThan(0);
      });
    });

    it('should display calendar icons for each reward', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const calendarIcons = screen.getAllByTestId('calendar-icon');
        expect(calendarIcons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Functionality - Email', () => {
    it('should filter rewards by email', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Bob Johnson/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'jane.smith@example.com');

      await waitFor(() => {
        expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Bob Johnson/)).not.toBeInTheDocument();
      });
    });

    it('should filter case-insensitively by email', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'JOHN.DOE@EXAMPLE.COM');

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
      });
    });

    it('should filter by partial email', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'bob.johnson');

      await waitFor(() => {
        expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Bob Johnson/).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Functionality - Name', () => {
    it('should filter rewards by user name', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'Jane Smith');

      await waitFor(() => {
        expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Bob Johnson/)).not.toBeInTheDocument();
      });
    });

    it('should filter case-insensitively by name', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'john doe');

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
      });
    });

    it('should filter by partial name', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'Bob');

      await waitFor(() => {
        expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Jane Smith/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Bob Johnson/).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Functionality - Coupon Code', () => {
    it('should filter rewards by coupon code', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'WELCOME50');

      await waitFor(() => {
        expect(screen.queryByText('SURVEY100 - 100 Baht Discount')).not.toBeInTheDocument();
        expect(screen.getAllByText('WELCOME50 - 50% Off Next Stay').length).toBeGreaterThan(0);
        expect(screen.queryByText('FREEWIFI - Free WiFi Upgrade')).not.toBeInTheDocument();
      });
    });

    it('should filter case-insensitively by coupon code', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'survey100');

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
        expect(screen.queryByText('WELCOME50 - 50% Off Next Stay')).not.toBeInTheDocument();
      });
    });

    it('should filter by partial coupon code', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('FREEWIFI - Free WiFi Upgrade').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'WIFI');

      await waitFor(() => {
        expect(screen.queryByText('SURVEY100 - 100 Baht Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('WELCOME50 - 50% Off Next Stay')).not.toBeInTheDocument();
        expect(screen.getAllByText('FREEWIFI - Free WiFi Upgrade').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Functionality - Coupon Name', () => {
    it('should filter rewards by coupon name', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, '50% Off');

      await waitFor(() => {
        expect(screen.queryByText('SURVEY100 - 100 Baht Discount')).not.toBeInTheDocument();
        expect(screen.getAllByText('WELCOME50 - 50% Off Next Stay').length).toBeGreaterThan(0);
        expect(screen.queryByText('FREEWIFI - Free WiFi Upgrade')).not.toBeInTheDocument();
      });
    });

    it('should filter case-insensitively by coupon name', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('FREEWIFI - Free WiFi Upgrade').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'free wifi');

      await waitFor(() => {
        expect(screen.queryByText('SURVEY100 - 100 Baht Discount')).not.toBeInTheDocument();
        expect(screen.queryByText('WELCOME50 - 50% Off Next Stay')).not.toBeInTheDocument();
        expect(screen.getAllByText('FREEWIFI - Free WiFi Upgrade').length).toBeGreaterThan(0);
      });
    });

    it('should filter by partial coupon name', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'Discount');

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
        expect(screen.queryByText('WELCOME50 - 50% Off Next Stay')).not.toBeInTheDocument();
        expect(screen.queryByText('FREEWIFI - Free WiFi Upgrade')).not.toBeInTheDocument();
      });
    });
  });

  describe('Pagination - Previous Button', () => {
    it('should disable previous button on first page', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const previousButton = screen.getByText('Previous');
        expect(previousButton).toBeDisabled();
      });
    });

    it('should enable previous button on second page', async () => {
      const user = userEvent.setup();
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        const previousButton = screen.getByText('Previous');
        expect(previousButton).not.toBeDisabled();
      });
    });
  });

  describe('Pagination - Next Button', () => {
    it('should disable next button on last page', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      });

      // Click next to go to page 2
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
        expect(nextButton).toBeDisabled();
      });
    });

    it('should enable next button when not on last page', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const nextButton = screen.getByText('Next');
        expect(nextButton).not.toBeDisabled();
      });
    });
  });

  describe('Pagination - Page Changes', () => {
    it('should load next page when clicking next button', async () => {
      const user = userEvent.setup();
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(surveyService.getSurveyRewardHistory).toHaveBeenCalledWith('survey-1', 2, 20);
      });
    });

    it('should load previous page when clicking previous button', async () => {
      const user = userEvent.setup();
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      });

      // Go to page 2
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      });

      // Go back to page 1
      const previousButton = screen.getByText('Previous');
      await user.click(previousButton);

      await waitFor(() => {
        expect(surveyService.getSurveyRewardHistory).toHaveBeenCalledWith('survey-1', 1, 20);
      });
    });

    it('should display correct page numbers', async () => {
      const user = userEvent.setup();
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 60,
        totalPages: 3,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
      });

      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
      });
    });

    it('should not display pagination when only one page', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 3,
        totalPages: 1,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      // Pagination should not be visible when totalPages is 1
      await waitFor(() => {
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
      });
    });

    it('should clamp page to maximum when clicking next on last page', async () => {
      const user = userEvent.setup();
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      });

      // Try clicking next again (should stay on page 2)
      await user.click(nextButton);

      // Should still be on page 2
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show toast on API error', async () => {
      const error = new Error('Network error');
      vi.mocked(surveyService.getSurveyRewardHistory).mockRejectedValueOnce(error);

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load reward history');
      });
    });

    it('should not display rewards on error', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockRejectedValueOnce(new Error('Network error'));

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should stop loading state on error', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockRejectedValueOnce(new Error('Network error'));

      const { container } = render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />
      );

      await waitFor(() => {
        expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();
      });
    });

    it('should handle null values in reward data gracefully', async () => {
      const rewardsWithNulls: SurveyRewardHistory[] = [{
        ...mockRewards[0]!,
        user_name: undefined,
        user_email: undefined,
        coupon_code: undefined,
        coupon_name: undefined,
      }];

      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: rewardsWithNulls,
        total: 1,
        totalPages: 1,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        // Should render without crashing
        expect(screen.getByText('Reward History')).toBeInTheDocument();
      });
    });
  });

  describe('Metadata Details Accordion', () => {
    it('should display View Details for rewards with metadata', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const viewDetailsLinks = screen.getAllByText('View Details');
        expect(viewDetailsLinks.length).toBeGreaterThan(0);
      });
    });

    it('should expand metadata when clicking View Details', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const viewDetailsLinks = screen.getAllByText('View Details');
        expect(viewDetailsLinks.length).toBeGreaterThan(0);
      });

      const viewDetailsLink = screen.getAllByText('View Details')[0]!;
      await user.click(viewDetailsLink);

      await waitFor(() => {
        const jsonContent = screen.getAllByText(/"survey_score"/)[0]!;
        expect(jsonContent).toBeInTheDocument();
      });
    });

    it('should display metadata as formatted JSON', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const viewDetailsLinks = screen.getAllByText('View Details');
        expect(viewDetailsLinks.length).toBeGreaterThan(0);
      });

      const viewDetailsLink = screen.getAllByText('View Details')[0]!;
      await user.click(viewDetailsLink);

      await waitFor(() => {
        const jsonContent = screen.getAllByText(/"survey_score"/)[0]!;
        const preElement = jsonContent.closest('pre');
        expect(preElement).toBeInTheDocument();
      });
    });

    it('should handle rewards without metadata', async () => {
      const rewardsWithoutMetadata: SurveyRewardHistory[] = [{
        ...mockRewards[0]!,
        metadata: null,
      }];

      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: rewardsWithoutMetadata,
        total: 1,
        totalPages: 1,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText('SURVEY100 - 100 Baht Discount').length).toBeGreaterThan(0);
      });

      // Should not display View Details if metadata is null
      expect(screen.queryByText('View Details')).not.toBeInTheDocument();
    });

    it('should handle empty metadata object', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const viewDetailsLinks = screen.getAllByText('View Details');
        // reward-2 has empty metadata {} but should still show View Details, once per layout (desktop + mobile)
        expect(viewDetailsLinks.length).toBe(6);
      });
    });
  });

  describe('Search Input', () => {
    it('should display search icon', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByTestId('search-icon')).toBeInTheDocument();
      });
    });

    it('should display search placeholder', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by email, name, coupon code or name...')).toBeInTheDocument();
      });
    });

    it('should update search term on input', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'test');

      expect(searchInput).toHaveValue('test');
    });

    it('should clear search and show all results when input is cleared', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');
      await user.type(searchInput, 'Jane');

      // Wait for filtering to happen
      expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);

      await user.clear(searchInput);

      // Wait for all results to show again
      expect(searchInput).toHaveValue('');
      expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Bob Johnson/).length).toBeGreaterThan(0);
    });
  });

  describe('Translation Keys', () => {
    it('should use correct translation keys', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.title');
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.description');
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.searchPlaceholder');
      });
    });

    it('should use correct translation for empty state', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: [],
        total: 0,
        totalPages: 0,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.noRewardsAwarded');
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.couponsWillAppear');
      });
    });

    it('should use correct translation for pagination', async () => {
      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValue({
        rewards: mockRewards,
        total: 25,
        totalPages: 2,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.page');
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.of');
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.previous');
        expect(mockTranslate).toHaveBeenCalledWith('surveys.rewardHistory.next');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long user names', async () => {
      const rewardsWithLongName: SurveyRewardHistory[] = [{
        ...mockRewards[0]!,
        user_name: 'Very Long Name That Exceeds Normal Length For Display Testing Purposes',
      }];

      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: rewardsWithLongName,
        total: 1,
        totalPages: 1,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/Very Long Name That Exceeds Normal Length/).length).toBeGreaterThan(0);
      });
    });

    it('should handle very long coupon codes', async () => {
      const rewardsWithLongCode: SurveyRewardHistory[] = [{
        ...mockRewards[0]!,
        coupon_code: 'VERYLONGCOUPONCODE123456789',
      }];

      vi.mocked(surveyService.getSurveyRewardHistory).mockResolvedValueOnce({
        rewards: rewardsWithLongCode,
        total: 1,
        totalPages: 1,
      });

      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/VERYLONGCOUPONCODE123456789/).length).toBeGreaterThan(0);
      });
    });

    it('should reload when surveyId prop changes', async () => {
      const { rerender } = render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Survey 1" />
      );

      await waitFor(() => {
        expect(surveyService.getSurveyRewardHistory).toHaveBeenCalledWith('survey-1', 1, 20);
      });

      vi.clearAllMocks();

      rerender(<SurveyRewardHistoryComponent surveyId="survey-2" surveyTitle="Survey 2" />);

      await waitFor(() => {
        expect(surveyService.getSurveyRewardHistory).toHaveBeenCalledWith('survey-2', 1, 20);
      });
    });

    it('should handle rapid search input changes', async () => {
      const user = userEvent.setup();
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText('Search by email, name, coupon code or name...');

      // Type rapidly
      await user.type(searchInput, 'abc');
      await user.clear(searchInput);
      await user.type(searchInput, 'Jane');

      expect(searchInput).toHaveValue('Jane');
      expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('should render its panels on the card surface', async () => {
      const { container } = render(
        <SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />
      );

      await waitFor(() => {
        const cards = container.querySelectorAll('[data-surface="card"]');
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    it('should render reward rows in a table on desktop', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('SURVEY100 - 100 Baht Discount')).toBeInTheDocument();
      });
    });

    it('should style the completed badge with the success tone', async () => {
      render(<SurveyRewardHistoryComponent surveyId="survey-1" surveyTitle="Customer Feedback Survey" />);

      await waitFor(() => {
        const badges = screen.getAllByText('Completed');
        badges.forEach(badge => {
          expect(badge).toHaveAttribute('data-tone', 'success');
        });
      });
    });
  });
});
