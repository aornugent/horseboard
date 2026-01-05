import { signal } from '@preact/signals';
import { sseClient } from './sse';
import { loadPermission } from './api';
import { setPermission as setPermissionStore } from '../stores';

export const STORAGE_KEY = 'hb_board_id';
export const TOKEN_STORAGE_KEY = 'hb_token';
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
        // Load cached permission from localStorage (instant UI)
        const cachedPermission = loadPermission();
        setPermissionStore(cachedPermission as any);

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
