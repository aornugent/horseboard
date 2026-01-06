import type { Board, Horse, Feed, DietEntry, TimeMode } from '@shared/resources';
import type { UnitType } from '@shared/unit-strategies';
import { signal } from '@preact/signals';
import { setPermission as setPermissionStore } from '../stores';
import { TOKEN_STORAGE_KEY } from './lifecycle';

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

export function getToken(): string | null {
  return controllerToken;
}

export function setControllerToken(token: string | null): void {
  controllerToken = token;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function loadControllerToken(): void {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    controllerToken = token;
  }
}

export const PERMISSION_STORAGE_KEY = 'hb_permission';

export function setPermission(permission: string): void {
  localStorage.setItem(PERMISSION_STORAGE_KEY, permission);
}

export function loadPermission(): string {
  return localStorage.getItem(PERMISSION_STORAGE_KEY) || 'view';
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
    if (response.status === 403) {
      // Permission denied - downgrade to view-only and show friendly message
      setPermission('view');
      setPermissionStore('view');
      onAuthError.value = { status: 403, message: 'You need edit access to do that' };
    } else if (response.status === 401) {
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



export interface ControllerToken {
  id: string;
  board_id: string;
  name: string;
  permission: 'view' | 'edit';
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}




export async function resolveToken(): Promise<{ token_id: string; board_id: string; permission: string }> {
  const result = await request<ApiResponse<{ token_id: string; board_id: string; permission: string }>>('/api/devices/me');
  if (!result.success || !result.data) {
    throw new ApiError('Failed to resolve token', 401);
  }
  return result.data;
}

export async function generateInviteCode(board_id: string): Promise<{ code: string; expires_at: string }> {
  const result = await request<ApiResponse<{ code: string; expires_at: string }>>(`/api/boards/${board_id}/invites`, {
    method: 'POST',
  });
  if (!result.success || !result.data) {
    throw new ApiError(result.error || 'Failed to generate invite code', 500);
  }
  return result.data;
}

export interface PairResult {
  success: boolean;
  board_id?: string;
  token?: string;
  error?: string;
}



export interface CreateBoardResult {
  id: string;
  pair_code: string;
}

export async function pairWithCode(code: string): Promise<PairResult> {
  try {
    const result = await request<ApiResponse<{ board_id: string; token: string; permission: string }>>('/api/pair', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    if (result.success && result.data) {
      // Store permission for UI decisions
      if (result.data.permission) {
        setPermission(result.data.permission);
      }
      return { success: true, board_id: result.data.board_id, token: result.data.token };
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
  unit_type: UnitType = 'fraction',
  unit_label: string = 'scoop',
  entry_options: string | null = null
): Promise<Feed> {
  const result = await request<ApiResponse<Feed>>(`/api/boards/${board_id}/feeds`, {
    method: 'POST',
    body: JSON.stringify({ name, unit_type, unit_label, entry_options }),
  });
  if (!result.data) {
    throw new ApiError('Failed to create feed', 500);
  }
  return result.data;
}

export async function updateFeed(
  feed_id: string,
  updates: { name?: string; unit_type?: UnitType; unit_label?: string; entry_options?: string | null }
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
  pm_amount?: number | null,
  am_variant?: string | null,
  pm_variant?: string | null,
): Promise<DietEntry> {
  const result = await request<ApiResponse<DietEntry>>('/api/diet', {
    method: 'PUT',
    body: JSON.stringify({ horse_id, feed_id, am_amount, pm_amount, am_variant, pm_variant }),
  });
  if (!result.data) {
    throw new ApiError('Failed to update diet', 500);
  }
  return result.data;
}

export async function pollProvisioning(code: string): Promise<{ pending?: boolean; token?: string }> {
  try {
    const result = await request<ApiResponse<{ pending?: boolean; token?: string }>>(`/api/devices/poll?code=${code}`);
    return result.data || { pending: true };
  } catch (err) {
    console.error('Polling failed', err);
    return { pending: true };
  }
}

export async function linkDevice(code: string, board_id: string): Promise<void> {
  const result = await request<ApiResponse<void>>('/api/devices/link', {
    method: 'POST',
    body: JSON.stringify({ code, board_id }),
  });
  if (!result.success) {
    throw new ApiError(result.error || 'Failed to link device', 500);
  }
}

export async function listDevices(): Promise<Array<{ id: string; name: string; board_pair_code: string; last_used_at: string | null }>> {
  const result = await request<ApiResponse<any[]>>('/api/devices');
  return result.data || [];
}

export async function revokeDeviceToken(token_id: string): Promise<void> {
  await request<void>(`/api/devices/${token_id}`, { method: 'DELETE' });
}
export async function listUserBoards(): Promise<Board[]> {
  const result = await request<ApiResponse<Board[]>>('/api/user/boards');
  return result.data ?? [];
}

export async function redeemInvite(code: string): Promise<{ token: string }> {
  const result = await request<ApiResponse<{ token: string; permission: string }>>('/api/invites/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  if (!result.success || !result.data) {
    throw new ApiError(result.error || 'Failed to redeem invite', 500);
  }

  const { token, permission } = result.data;
  setControllerToken(token);
  // Store permission for UI decisions
  if (permission) {
    setPermission(permission);
  }
  return { token };
}
