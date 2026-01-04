import { signal } from '@preact/signals';
import { sseClient } from './sse';
import { loadPermission } from './api';
import { setPermission as setPermissionStore } from '../stores';

export const STORAGE_KEY = 'horseboard_board_id';
export const TOKEN_STORAGE_KEY = 'horseboard_controller_token';
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
