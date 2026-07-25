import { useEffect } from 'react';
import { useLocation } from 'react-router';

const HF_BAR_HOST_ID = 'hf-bar-host';
const HF_BAR_SCRIPT_SRC = 'https://erp.thehfhotel.org/shell/hf-bar.js';
const HF_BAR_SCRIPT_MARKER = 'data-hf-bar-script';

// Staff-only route prefixes. Every admin page in this app is mounted
// under `/admin` (see the route table in App.tsx) — there is no route
// that serves both guests and staff, so this single prefix unambiguously
// covers all admin screens without risking a false positive on a
// guest-facing route.
const ADMIN_ROUTE_PREFIXES = ['/admin'];

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function injectBandScript(): void {
  const script = document.createElement('script');
  script.src = HF_BAR_SCRIPT_SRC;
  script.defer = true;
  script.setAttribute('data-app', 'Loyalty Admin');
  script.setAttribute('data-module', 'guest');
  script.setAttribute('data-portal-only', '1');
  script.setAttribute(HF_BAR_SCRIPT_MARKER, '1');
  document.body.appendChild(script);
}

function removeBand(): void {
  document.getElementById(HF_BAR_HOST_ID)?.remove();
  document.querySelectorAll(`script[${HF_BAR_SCRIPT_MARKER}]`).forEach((node) => node.remove());
}

/**
 * Mounts the HF One portal-switcher band (hf-bar.js) on staff-facing
 * admin routes only.
 *
 * loyalty.saichon.com is guest-facing (LINE/Google login hotel guests
 * share the same shell as staff), so the internal cross-app switcher
 * must never render on a guest route — not even transiently. The script
 * is only appended while the current route matches an admin prefix, and
 * the band's host element (`#hf-bar-host`, the plain in-flow div the
 * script inserts at the top of <body> — see HF-ONE.md) is removed the
 * moment navigation leaves admin routes.
 */
export function useAdminPortalBand(): void {
  const location = useLocation();

  useEffect(() => {
    if (isAdminRoute(location.pathname)) {
      if (!document.getElementById(HF_BAR_HOST_ID)) {
        injectBandScript();
      }
      return;
    }

    removeBand();
  }, [location.pathname]);
}
