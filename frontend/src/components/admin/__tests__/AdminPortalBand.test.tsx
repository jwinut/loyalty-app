import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import AdminPortalBand from '../AdminPortalBand';

const HF_BAR_SCRIPT_SELECTOR = 'script[data-hf-bar-script]';
const HF_BAR_SRC = 'https://erp.thehfhotel.org/shell/hf-bar.js';

function NavigationButtons() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/admin/loyalty')}>go-admin</button>
      <button onClick={() => navigate('/admin/surveys/create')}>go-admin-nested</button>
      <button onClick={() => navigate('/dashboard')}>go-guest</button>
      <button onClick={() => navigate('/administration-report')}>go-lookalike</button>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavigationButtons />
      <AdminPortalBand />
    </MemoryRouter>
  );
}

// The hook manipulates the DOM directly (outside React), so React
// Testing Library's automatic cleanup won't undo it between tests.
afterEach(() => {
  document.querySelectorAll(HF_BAR_SCRIPT_SELECTOR).forEach((node) => node.remove());
  document.getElementById('hf-bar-host')?.remove();
});

describe('AdminPortalBand', () => {
  it('renders nothing visible', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/loyalty']}>
        <AdminPortalBand />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('injects the hf-bar.js script on an admin route', () => {
    renderAt('/admin/loyalty');

    const script = document.querySelector(HF_BAR_SCRIPT_SELECTOR);
    expect(script).not.toBeNull();
    expect(script?.getAttribute('src')).toBe(HF_BAR_SRC);
    expect(script?.getAttribute('data-app')).toBe('Loyalty Admin');
    expect(script?.getAttribute('data-module')).toBe('guest');
    expect(script?.getAttribute('data-portal-only')).toBe('1');
    expect(script?.hasAttribute('defer')).toBe(true);
  });

  it('injects on nested admin routes (e.g. survey builder)', () => {
    renderAt('/admin/surveys/create');
    expect(document.querySelector(HF_BAR_SCRIPT_SELECTOR)).not.toBeNull();
  });

  it('does not inject on guest routes', () => {
    renderAt('/dashboard');
    expect(document.querySelector(HF_BAR_SCRIPT_SELECTOR)).toBeNull();
  });

  it('does not inject on other guest routes (coupons, surveys, booking)', () => {
    for (const path of ['/coupons', '/surveys', '/booking', '/my-bookings', '/profile']) {
      renderAt(path);
      expect(document.querySelector(HF_BAR_SCRIPT_SELECTOR)).toBeNull();
    }
  });

  it('does not treat a path that merely starts with "admin" as an admin route', () => {
    // Guards against a naive `pathname.startsWith('/admin')` prefix match
    // that would false-positive on something like `/administration-report`.
    renderAt('/administration-report');
    expect(document.querySelector(HF_BAR_SCRIPT_SELECTOR)).toBeNull();
  });

  it('does not append a second script if the band host is already mounted', () => {
    renderAt('/admin/loyalty');
    // Simulate hf-bar.js having already run and inserted its host div.
    const host = document.createElement('div');
    host.id = 'hf-bar-host';
    document.body.appendChild(host);

    fireEvent.click(screen.getByText('go-admin-nested'));

    expect(document.querySelectorAll(HF_BAR_SCRIPT_SELECTOR).length).toBe(1);
  });

  it('removes the band host when navigating from an admin route to a guest route', () => {
    renderAt('/admin/loyalty');

    // Simulate hf-bar.js having inserted its shadow-DOM host div.
    const host = document.createElement('div');
    host.id = 'hf-bar-host';
    document.body.appendChild(host);

    fireEvent.click(screen.getByText('go-guest'));

    expect(document.getElementById('hf-bar-host')).toBeNull();
    expect(document.querySelector(HF_BAR_SCRIPT_SELECTOR)).toBeNull();
  });

  it('never leaves the band mounted after bouncing through a guest route', () => {
    renderAt('/admin/loyalty');
    const host = document.createElement('div');
    host.id = 'hf-bar-host';
    document.body.appendChild(host);

    fireEvent.click(screen.getByText('go-lookalike'));

    expect(document.getElementById('hf-bar-host')).toBeNull();
  });

  it('re-injects after returning to an admin route once the host was removed', () => {
    renderAt('/admin/loyalty');
    const host = document.createElement('div');
    host.id = 'hf-bar-host';
    document.body.appendChild(host);

    fireEvent.click(screen.getByText('go-guest'));
    expect(document.getElementById('hf-bar-host')).toBeNull();

    fireEvent.click(screen.getByText('go-admin'));
    expect(document.querySelector(HF_BAR_SCRIPT_SELECTOR)).not.toBeNull();
  });
});
