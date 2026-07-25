import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import MinimalShell from '../MinimalShell';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher">Language Switcher</div>,
}));

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('MinimalShell', () => {
  it('renders children', () => {
    renderWithRouter(
      <MinimalShell>
        <div data-testid="child-content">Content</div>
      </MinimalShell>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders the brand lockup (monogram + wordmark)', () => {
    const { container } = renderWithRouter(
      <MinimalShell>Content</MinimalShell>,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('The Harbour Front Hotel')).toBeInTheDocument();
  });

  it('renders the language switcher', () => {
    renderWithRouter(<MinimalShell>Content</MinimalShell>);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('renders the privacy footer link', () => {
    renderWithRouter(<MinimalShell>Content</MinimalShell>);
    expect(screen.getByTestId('footer-privacy-link')).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
