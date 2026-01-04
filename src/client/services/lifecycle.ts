import { signal } from '@preact/signals';
import { sseClient } from './sse';
import { loadPermission, resolveToken, ApiError } from './api';
import { setPermission as setPermissionStore } from '../stores';

export const STORAGE_KEY = 'horseboard_board_id';
export const TOKEN_STORAGE_KEY = 'horseboard_controller_token';
export const isInitialized = signal(false);
export const connectionError = signal<string | null>(null);
export const isTokenInvalid = signal(false);

/**
 * Validate the stored controller token. If invalid (revoked), clear storage.
 * Returns true if token is valid or no token exists, false if token was revoked.
 */
export async function validateToken(): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
        // No token - nothing to validate (session-based auth or no auth)
        return true;
    }

    try {
        await resolveToken();
        return true;
    } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            // Token is invalid/revoked - clear storage and mark as invalid
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('horseboard_permission');
            isTokenInvalid.value = true;
            return false;
        }
        // Other errors (network, etc.) - don't invalidate
        throw error;
    }
}

/**
 * Initialize the app by loading cached permission and connecting to SSE.
 * Permission is cached from pair/redeem responses for instant UI.
 * SSE provides board data and real-time updates (unauthenticated).
 */
export async function initializeApp(boardId: string): Promise<boolean> {
    try {
        // Validate token first (for TV displays with controller tokens)
        const tokenValid = await validateToken();
        if (!tokenValid) {
            // Token was revoked - don't initialize, let Router show provisioning
            return false;
        }

        // Load cached permission from localStorage (instant UI)
        const cachedPermission = loadPermission();
        setPermissionStore(cachedPermission as any);

        // Connect to SSE for board data and live updates
        await sseClient.connect(boardId);
        isInitialized.value = true;
        isTokenInvalid.value = false;
        connectionError.value = null;
        return true;
    } catch (error) {
        console.error('SSE connection failed:', error);
        connectionError.value = 'Connection failed';
        return false;
    }
}
