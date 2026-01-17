
import { computed } from '@preact/signals';
import { user, isAuthLoading } from '../stores';
import { accessToken, boardId } from '../stores/token';
import { permission } from '../stores/permission';
import { pathname } from '../router';

export type AppMode = 'loading' | 'owner' | 'staff' | 'display' | 'unauthenticated';

export const appMode = computed<AppMode>(() => {
  // Check for owner session
  if (user.value) return 'owner';

  // Check for token (staff or display)
  const hasToken = !!accessToken.value;
  const hasBoardId = !!boardId.value;

  if (hasToken && hasBoardId) {
    // Display mode if on /board path
    if (pathname.value === '/board') return 'display';
    return 'staff';
  }

  // Allow view-only access with just board ID (no token)
  // This enables controller viewing after sign out when board ID persists
  if (hasBoardId) {
    if (pathname.value === '/board') return 'display';
    return 'staff';
  }

  // Still initializing auth - only block for routes where we want to avoid flashes
  if (isAuthLoading.value) {
    const path = pathname.value;
    // Don't block Landing or Board (provisioning) - they should render optimistically
    if (path !== '/' && path !== '/board') {
      return 'loading';
    }
  }

  // No auth
  return 'unauthenticated';
});

export const canEdit = computed(() =>
  appMode.value === 'owner' || (appMode.value === 'staff' && (permission.value === 'edit' || permission.value === 'admin'))
);

export const isOwner = computed(() => appMode.value === 'owner');

// isAdmin accounts for owner sessions (always admin) and admin permission tokens
export const isAdmin = computed(() =>
  appMode.value === 'owner' || permission.value === 'admin'
);
