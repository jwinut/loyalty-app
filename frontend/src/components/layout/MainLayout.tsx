import { ReactNode } from 'react';
import AppShell from './AppShell';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  showProfileBanner?: boolean;
}

/**
 * Thin compatibility wrapper around AppShell for pages that haven't been
 * migrated to call AppShell directly. Keeps the historical MainLayout prop
 * interface so its existing consumers render unchanged.
 */
export default function MainLayout({ children, title, showProfileBanner = true }: MainLayoutProps) {
  return (
    <AppShell variant="guest" title={title} showProfileBanner={showProfileBanner}>
      {children}
    </AppShell>
  );
}
