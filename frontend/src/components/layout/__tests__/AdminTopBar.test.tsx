import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminTopBar from '../AdminTopBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher">Language Switcher</div>,
}));

vi.mock('../../navigation/DashboardButton', () => ({
  default: ({ variant, size }: { variant: string; size: string }) => (
    <button
      data-testid="dashboard-button"
      data-variant={variant}
      data-size={size}
    >
      Dashboard
    </button>
  ),
}));

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('AdminTopBar', () => {
  it('renders the DashboardButton with variant=outline size=sm', () => {
    renderWithRouter(<AdminTopBar />);
    const button = screen.getByTestId('dashboard-button');
    expect(button.getAttribute('data-variant')).toBe('outline');
    expect(button.getAttribute('data-size')).toBe('sm');
  });

  it('shows the page title', () => {
    renderWithRouter(<AdminTopBar title="Admin Section" />);
    expect(screen.getByText('Admin Section')).toBeInTheDocument();
  });

  it('renders the language switcher', () => {
    renderWithRouter(<AdminTopBar />);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('is sticky and never fixed, so it stacks below the injected admin band', () => {
    const { container } = renderWithRouter(<AdminTopBar />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('sticky');
    expect(header?.className).not.toContain('fixed');
  });
});
