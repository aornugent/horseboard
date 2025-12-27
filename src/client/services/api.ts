import { setBoard, setHorses, setFeeds, setDietEntries } from '../stores';
import type { Board, Horse, Feed, DietEntry } from '@shared/resources';

interface BootstrapResponse {
  success: boolean;
  data?: {
    board: Board;
    horses: Horse[];
    feeds: Feed[];
    diet_entries: DietEntry[];
  };
  error?: string;
}

interface PairResponse {
  success: boolean;
  board_id?: string;
  error?: string;
}

/**
 * Bootstrap the application with initial data
 */
export async function bootstrap(boardId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/bootstrap/${boardId}`);
    const result: BootstrapResponse = await response.json();

    if (result.success && result.data) {
      setBoard(result.data.board);
      setHorses(result.data.horses);
      setFeeds(result.data.feeds);
      setDietEntries(result.data.diet_entries);
      return true;
    }

    console.error('Bootstrap failed:', result.error);
    return false;
  } catch (err) {
    console.error('Bootstrap error:', err);
    return false;
  }
}

/**
 * Pair with a board using a 6-digit code
 */
export async function pairWithCode(code: string): Promise<{ success: boolean; board_id?: string; error?: string }> {
  try {
    const response = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const result: PairResponse = await response.json();

    if (result.success && result.board_id) {
      // Bootstrap the board data
      await bootstrap(result.board_id);
    }

    return result;
  } catch (err) {
    console.error('Pair error:', err);
    return { success: false, error: 'Connection failed' };
  }
}

/**
 * Create a new board
 */
export async function createBoard(): Promise<{ success: boolean; board?: Board; error?: string }> {
  try {
    const response = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const board: Board = await response.json();

    if (board.id) {
      setBoard(board);
      return { success: true, board };
    }

    return { success: false, error: 'Failed to create board' };
  } catch (err) {
    console.error('Create board error:', err);
    return { success: false, error: 'Connection failed' };
  }
}

export default { bootstrap, pairWithCode, createBoard };
