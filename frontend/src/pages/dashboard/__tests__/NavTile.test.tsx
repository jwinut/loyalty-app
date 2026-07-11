import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FiCreditCard } from 'react-icons/fi';
import NavTile from '../NavTile';
import type { NavCardDef } from '../navCards';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderCard(card: NavCardDef) {
  return render(
    <MemoryRouter>
      <NavTile card={card} />
    </MemoryRouter>
  );
}

describe('NavTile', () => {
  const card: NavCardDef = {
    to: '/member-card',
    icon: FiCreditCard,
    titleKey: 'memberCard.title',
    descKey: 'memberCard.dashboardDescription',
    testId: 'nav-member-card',
  };

  it('renders the title and description text', () => {
    renderCard(card);

    expect(screen.getByText('memberCard.title')).toBeInTheDocument();
    expect(screen.getByText('memberCard.dashboardDescription')).toBeInTheDocument();
  });

  it('wraps the whole tile in a single link to the card destination', () => {
    renderCard(card);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/member-card');
  });

  it('stamps the provided data-testid on the link (Playwright depends on this)', () => {
    renderCard(card);

    expect(screen.getByTestId('nav-member-card')).toBeInTheDocument();
  });

  it('renders without a testid when the card does not define one', () => {
    const { container } = renderCard({ ...card, testId: undefined });

    expect(container.querySelector('[data-testid]')).not.toBeInTheDocument();
  });

  it('hides the icon chip from the accessibility tree', () => {
    const { container } = renderCard(card);

    const iconChip = container.querySelector('[aria-hidden="true"]');
    expect(iconChip).toBeInTheDocument();
  });
});
