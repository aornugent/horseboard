import { signal } from '@preact/signals';
import { sseClient } from './sse';

export const STORAGE_KEY = 'horseboard_board_id';
export const TOKEN_STORAGE_KEY = 'horseboard_controller_token';
export const isInitialized = signal(false);
export const connectionError = signal<string | null>(null);
export const isTokenInvalid = signal(false);

/**
 * Initialize the app by connecting to SSE.
 * SSE sends initial state (board, horses, feeds, diet_entries, permission) on connect.
 * No bootstrap API call needed - SSE is the single source of truth.
 */
export async function initializeApp(boardId: string): Promise<boolean> {
    try {
        // SSE connection handles hydration via initial event
        await sseClient.connect(boardId);
        isInitialized.value = true;
        isTokenInvalid.value = false;
        connectionError.value = null;
        return true;
    } catch (error) {
        // SSE connection failed - could be auth failure or network issue
        // For now, treat as connection error. Auth failures are handled via onAuthError signal.
        console.error('SSE connection failed:', error);
        connectionError.value = 'Connection failed';
        return false;
    }
}
