import { useAdminPortalBand } from '../../hooks/useAdminPortalBand';

/**
 * Renders nothing itself — mounts the HF One admin portal band on
 * staff-facing `/admin/*` routes via `useAdminPortalBand`, and tears it
 * down on any other route so guests never see it. Rendered once, high in
 * the router tree, alongside `SessionManager`.
 */
export default function AdminPortalBand() {
  useAdminPortalBand();
  return null;
}
