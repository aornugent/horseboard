import type { Board, Horse, Feed, DietEntry, Unit, TimeMode } from '@shared/resources';
import { signal } from '@preact/signals';

export const onAuthError = signal<{ status: number; message: string } | null>(null);

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


let controllerToken: string | null = null;

export function setControllerToken(token: string | null): void {
  controllerToken = token;
  if (token) {
    localStorage.setItem('horseboard_controller_token', token);
  } else {
    localStorage.removeItem('horseboard_controller_token');
  }
}

export function loadControllerToken(): void {
  const token = localStorage.getItem('horseboard_controller_token');
  if (token) {
    controllerToken = token;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (controllerToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${controllerToken}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      onAuthError.value = { status: response.status, message: 'Authentication failed' };
    }

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

// ... existing interfaces ...

export interface ControllerToken {
  id: string;
  board_id: string;
  name: string;
  permission: 'view' | 'edit';
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// ... existing functions ...

export async function createControllerToken(
  board_id: string,
  name: string,
  permission: 'view' | 'edit',
  expiresAt?: string
): Promise<{ id: string; name: string; token: string }> {
  const result = await request<ApiResponse<{ id: string; name: string; token: string }>>(
    `/api/boards/${board_id}/tokens`,
    {
      method: 'POST',
      body: JSON.stringify({ name, permission, expires_at: expiresAt }),
    }
  );
  if (!result.success || !result.data) {
    throw new ApiError(result.error || 'Failed to create token', 500);
  }
  return result.data;
}

export async function listControllerTokens(board_id: string): Promise<ControllerToken[]> {
  const result = await request<ApiResponse<ControllerToken[]>>(`/api/boards/${board_id}/tokens`);
  return result.data ?? [];
}

export async function revokeControllerToken(token_id: string): Promise<void> {
  await request<void>(`/api/tokens/${token_id}`, { method: 'DELETE' });
}

export async function resolveToken(): Promise<{ token_id: string; board_id: string; permission: string }> {
  const result = await request<ApiResponse<{ token_id: string; board_id: string; permission: string }>>('/api/tokens/me');
  if (!result.success || !result.data) {
    throw new ApiError('Failed to resolve token', 401);
  }
  return result.data;
}

export interface BootstrapData {
  board: Board;
  horses: Horse[];
  feeds: Feed[];
  diet_entries: DietEntry[];
  ownership: {
    is_claimed: boolean;
    is_owner: boolean;
    permission: 'none' | 'view' | 'edit' | 'admin';
  };
}

export interface PairResult {
  success: boolean;
  board_id?: string;
  error?: string;
}

export async function claimBoard(board_id: string): Promise<Board> {
  const result = await request<ApiResponse<Board>>(`/api/boards/${board_id}/claim`, {
    method: 'POST',
  });
  if (!result.success || !result.data) {
    throw new ApiError(result.error || 'Failed to claim board', 500);
  }
  return result.data;
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

export async function createHorse(
  board_id: string,
  name: string,
  note?: string | null
): Promise<Horse> {
  const result = await request<ApiResponse<Horse>>(`/api/boards/${board_id}/horses`, {
    method: 'POST',
    body: JSON.stringify({ name, note }),
  });
  if (!result.data) {
    throw new ApiError('Failed to create horse', 500);
  }
  return result.data;
}

export async function updateHorse(
  horse_id: string,
  updates: { name?: string; note?: string | null }
): Promise<Horse> {
  const result = await request<ApiResponse<Horse>>(`/api/horses/${horse_id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!result.data) {
    throw new ApiError('Failed to update horse', 500);
  }
  return result.data;
}

export async function deleteHorse(horse_id: string): Promise<void> {
  await request<void>(`/api/horses/${horse_id}`, {
    method: 'DELETE',
  });
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

export async function upsertDiet(
  horse_id: string,
  feed_id: string,
  am_amount?: number | null,
  pm_amount?: number | null
): Promise<DietEntry> {
  const result = await request<ApiResponse<DietEntry>>('/api/diet', {
    method: 'PUT',
    body: JSON.stringify({ horse_id, feed_id, am_amount, pm_amount }),
  });
  if (!result.data) {
    throw new ApiError('Failed to update diet', 500);
  }
  return result.data;
}
