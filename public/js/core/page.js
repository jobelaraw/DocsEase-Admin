// Start of every admin page module:
//   const session = await startPage();                       // any active admin
//   const session = await startPage({ superAdminOnly: true });
// Checks the session (redirecting if needed), wires the profile menu and the
// sidebar's pending-requests badge.
import { requireAdmin } from './session.js';
import '../components/profile-menu.js';
import { startReviewBadge } from '../components/review-badge.js';

export async function startPage({ superAdminOnly = false, badge = true } = {}) {
  const session = await requireAdmin({ superAdminOnly });
  if (badge) startReviewBadge(session);
  return session;
}
