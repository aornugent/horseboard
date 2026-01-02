import { signal } from '@preact/signals';
import { bootstrap, ApiError } from './api';
import { sseClient } from './sse';
import { board, setBoard, setHorses, setFeeds, setDietEntries, setOwnership } from '../stores';

export const STORAGE_KEY = 'horseboard_board_id';
export const TOKEN_STORAGE_KEY = 'horseboard_controller_token';
export const isInitialized = signal(false);
export const connectionError = signal<string | null>(null);
export const isTokenInvalid = signal(false);

export async function initializeApp(boardId: string): Promise<boolean> {
    try {
        const data = await bootstrap(boardId);
        setBoard(data.board);
        setHorses(data.horses);
        setFeeds(data.feeds);
        setDietEntries(data.diet_entries);
        if (data.ownership) {
            setOwnership(data.ownership);
        }

        await sseClient.connect(boardId);
        isInitialized.value = true;
        isTokenInvalid.value = false;
        connectionError.value = null;
        return true;
    } catch (error) {
        // Check if this is an auth failure (token revoked)
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            // Token is invalid - clear all client state to trigger reprovisioning
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            board.value = null;
            isTokenInvalid.value = true;
            isInitialized.value = false;
            return false;
        }
        connectionError.value = 'Connection failed';
        return false;
    }
}


