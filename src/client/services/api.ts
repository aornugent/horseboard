import type { Board, Horse, Feed, DietEntry, Unit, TimeMode } from '@shared/resources';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text();
    let message = 'Request failed';
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || message;
    } catch {
      message = text || message;
    }
    throw new ApiError(message, response.status);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text);
}

export interface BootstrapData {
  board: Board;
  horses: Horse[];
  feeds: Feed[];
  diet_entries: DietEntry[];
}

export interface PairResult {
  success: boolean;
  board_id?: string;
  error?: string;
}

export interface CreateBoardResult {
  id: string;
  pair_code: string;
}

export async function bootstrap(board_id: string): Promise<BootstrapData> {
  const result = await request<ApiResponse<BootstrapData>>(`/api/bootstrap/${board_id}`);
  if (!result.success || !result.data) {
    throw new ApiError(result.error || 'Bootstrap failed', 500);
  }
  return result.data;
}

export async function pairWithCode(code: string): Promise<PairResult> {
  try {
    const result = await request<ApiResponse<BootstrapData>>(`/api/bootstrap/pair/${code}`);
    if (result.success && result.data?.board) {
      return { success: true, board_id: result.data.board.id };
    }
    return { success: false, error: 'Invalid pairing code' };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Connection failed' };
  }
}

export async function createBoard(): Promise<Board> {
  const result = await request<ApiResponse<Board>>('/api/boards', {
    method: 'POST',
  });
  if (!result.success || !result.data) {
    throw new ApiError(result.error || 'Failed to create board', 500);
  }
  return result.data;
}

export async function createFeed(
  board_id: string,
  name: string,
  unit: Unit
): Promise<Feed> {
  const result = await request<ApiResponse<Feed>>(`/api/boards/${board_id}/feeds`, {
    method: 'POST',
    body: JSON.stringify({ name, unit }),
  });
  if (!result.data) {
    throw new ApiError('Failed to create feed', 500);
  }
  return result.data;
}

export async function updateFeed(
  feed_id: string,
  updates: { name?: string; unit?: Unit }
): Promise<Feed> {
  const result = await request<ApiResponse<Feed>>(`/api/feeds/${feed_id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!result.data) {
    throw new ApiError('Failed to update feed', 500);
  }
  return result.data;
}

export async function deleteFeed(feed_id: string): Promise<void> {
  await request<void>(`/api/feeds/${feed_id}`, {
    method: 'DELETE',
  });
}

export async function updateTimeMode(
  board_id: string,
  time_mode: TimeMode,
  override_until: string | null
): Promise<Board> {
  const result = await request<ApiResponse<Board>>(`/api/boards/${board_id}/time-mode`, {
    method: 'PUT',
    body: JSON.stringify({ time_mode, override_until }),
  });
  if (!result.data) {
    throw new ApiError('Failed to update time mode', 500);
  }
  return result.data;
}

export async function updateBoard(
  board_id: string,
  updates: { timezone?: string; zoom_level?: 1 | 2 | 3; current_page?: number }
): Promise<Board> {
  const result = await request<ApiResponse<Board>>(`/api/boards/${board_id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!result.data) {
    throw new ApiError('Failed to update board', 500);
  }
  return result.data;
}
