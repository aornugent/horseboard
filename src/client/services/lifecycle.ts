import { signal } from '@preact/signals';
import { sseClient } from './sse';
import { resolveToken } from './api';
import { setPermission as setPermissionStore } from '../stores/permission';

export { STORAGE_KEY, TOKEN_STORAGE_KEY } from '../constants';
import { STORAGE_KEY, TOKEN_STORAGE_KEY } from '../constants';

export const isInitialized = signal(false);
export const connectionError = signal<string | null>(null);
export const isTokenInvalid = signal(false);

/**
 * Initialize the app by loading cached permission and connecting to SSE.
 * Permission is cached from pair/redeem responses for instant UI.
 * SSE provides board data and real-time updates (unauthenticated).
 */
export async function initializeApp(boardId: string): Promise<boolean> {
    try {
        // Load permission from token if available
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (token) {
            try {
                const { permission } = await resolveToken();
                if (permission) {
                    setPermissionStore(permission as any);
                }
            } catch (err) {
                console.warn('Failed to resolve token permission:', err);
                // Fallback to view-only is safe (store default)
            }
        }

        // Connect to SSE for board data and live updates
        await sseClient.connect(boardId);

        // Handle token revocation (display unlinked)
        sseClient.onRevoked(() => {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            isTokenInvalid.value = true;
        });

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
