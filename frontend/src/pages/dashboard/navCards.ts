import {
  FiAward,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiCreditCard,
  FiGift,
  FiGrid,
  FiHome,
  FiList,
  FiMail,
  FiTag,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';

export type NavCardDef = {
  to: string;
  icon: IconType;
  titleKey: string;
  descKey: string;
  testId?: string;
};

/** Guest-facing "My Services" grid on the dashboard. */
export const GUEST_NAV_CARDS: NavCardDef[] = [
  {
    to: '/member-card',
    icon: FiCreditCard,
    titleKey: 'memberCard.title',
    descKey: 'memberCard.dashboardDescription',
    testId: 'nav-member-card',
  },
  {
    to: '/profile',
    icon: FiUser,
    titleKey: 'dashboard.myProfile',
    descKey: 'dashboard.manageProfile',
    testId: 'nav-profile',
  },
  {
    to: '/coupons',
    icon: FiTag,
    titleKey: 'dashboard.myCoupons',
    descKey: 'dashboard.manageCoupons',
  },
  {
    to: '/surveys',
    icon: FiClipboard,
    titleKey: 'dashboard.surveys',
    descKey: 'dashboard.takeSurveys',
  },
  {
    to: '/booking',
    icon: FiCalendar,
    titleKey: 'booking.bookRoom',
    descKey: 'booking.bookRoomDescription',
    testId: 'nav-booking',
  },
  {
    to: '/my-bookings',
    icon: FiBriefcase,
    titleKey: 'booking.myBookings',
    descKey: 'booking.viewMyBookings',
    testId: 'nav-my-bookings',
  },
];

/** Admin-only management grid, shown below the guest grid for admin+ roles. */
export const ADMIN_NAV_CARDS: NavCardDef[] = [
  {
    to: '/admin/loyalty',
    icon: FiAward,
    titleKey: 'dashboard.loyaltyManagement',
    descKey: 'dashboard.manageLoyaltyAdmin',
  },
  {
    to: '/admin/coupons',
    icon: FiTag,
    titleKey: 'dashboard.couponManagement',
    descKey: 'dashboard.manageCouponsAdmin',
  },
  {
    to: '/admin/surveys',
    icon: FiBarChart2,
    titleKey: 'dashboard.surveyManagement',
    descKey: 'dashboard.manageSurveysAdmin',
  },
  {
    to: '/admin/users',
    icon: FiUsers,
    titleKey: 'dashboard.userManagement',
    descKey: 'dashboard.manageUsersAdmin',
  },
  {
    to: '/admin/new-member-coupons',
    icon: FiGift,
    titleKey: 'admin.newMemberCoupons.menuTitle',
    descKey: 'admin.newMemberCoupons.menuDescription',
  },
  {
    to: '/admin/transaction-history',
    icon: FiBarChart2,
    titleKey: 'admin.loyalty.transactionHistory',
    descKey: 'admin.loyalty.viewTransactionHistory',
  },
  {
    to: '/admin/email-service',
    icon: FiMail,
    titleKey: 'dashboard.emailService',
    descKey: 'dashboard.emailServiceDesc',
  },
  {
    to: '/admin/room-types',
    icon: FiHome,
    titleKey: 'admin.booking.roomTypes.title',
    descKey: 'admin.booking.roomTypes.subtitle',
    testId: 'nav-admin-room-types',
  },
  {
    to: '/admin/rooms',
    icon: FiGrid,
    titleKey: 'admin.booking.rooms.title',
    descKey: 'admin.booking.rooms.subtitle',
    testId: 'nav-admin-rooms',
  },
  {
    to: '/admin/room-availability',
    icon: FiCalendar,
    titleKey: 'admin.booking.availability.title',
    descKey: 'admin.booking.availability.subtitle',
    testId: 'nav-admin-availability',
  },
  {
    to: '/admin/booking-management',
    icon: FiList,
    titleKey: 'admin.booking.bookingManagement.menuTitle',
    descKey: 'admin.booking.bookingManagement.menuDescription',
    testId: 'nav-admin-booking-management',
  },
];
