import { signal } from '@preact/signals';
import { bootstrap } from './api';
import { sseClient } from './sse';
import { setBoard, setHorses, setFeeds, setDietEntries, setOwnership } from '../stores';

export const STORAGE_KEY = 'horseboard_board_id';
export const isInitialized = signal(false);
export const connectionError = signal<string | null>(null);

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
        connectionError.value = null;
        return true;
    } catch {
        connectionError.value = 'Connection failed';
        return false;
    }
}
