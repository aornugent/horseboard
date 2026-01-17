/**
 * E2E Test API Helpers
 *
 * Functions for creating and managing test data via the API.
 * These helpers allow tests to seed their own isolated data.
 */

import { APIRequestContext } from '@playwright/test';


// API base URL (matches playwright.config.ts)
const BASE_URL = 'http://localhost:5173';

// Test authentication header - grants admin permission in test mode
// Must match the x-test-user-id header check in auth.ts
const TEST_AUTH_HEADERS = {
  'x-test-user-id': 'e2e-test-user',
};

// =============================================================================
// TYPES
// =============================================================================

export interface Board {
  id: string;
  pair_code: string;
  timezone: string;
  time_mode: 'AUTO' | 'AM' | 'PM';
  override_until: string | null;
  zoom_level: number;
  current_page: number;
  created_at: string;
  updated_at: string;
}

export interface Horse {
  id: string;
  board_id: string;
  name: string;
  note: string | null;
  note_expiry: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Feed {
  id: string;
  board_id: string;
  name: string;
  unit_type: 'fraction' | 'int' | 'decimal' | 'choice';
  unit_label: string;
  entry_options: string | null;
  rank: number;
  stock_level: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface DietEntry {
  horse_id: string;
  feed_id: string;
  am_amount: number | null;
  pm_amount: number | null;
  am_variant: string | null;
  pm_variant: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// PREVIEW AUTH HELPERS
// =============================================================================

/**
 * Create a preview user via Better Auth signup.
 * Used by owner preview specs for real session auth.
 */
export async function createPreviewUser(
  request: APIRequestContext,
  email = 'preview@test.local',
  password = 'preview123'
): Promise<{ email: string; password: string }> {
  await request.post(`${BASE_URL}/api/auth/sign-up/email`, {
    data: { email, password, name: 'Preview User' },
  });
  return { email, password };
}

/**
 * Create a real controller token via /pair endpoint.
 * Used by staff/display preview specs.
 */
export async function createPreviewToken(
  request: APIRequestContext,
  pairCode: string
): Promise<{ token: string; permission: string }> {
  const response = await request.post(`${BASE_URL}/api/pair`, {
    data: { code: pairCode },
  });
  const json = await response.json();
  return { token: json.data.token, permission: json.data.permission };
}

// =============================================================================
// BOARD API
// =============================================================================

/**
 * Create a new board via POST /api/boards
 */
export async function createBoard(request: APIRequestContext): Promise<Board> {
  const response = await request.post(`${BASE_URL}/api/boards`, {
    data: {},
    headers: TEST_AUTH_HEADERS,
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create board: ${response.status()} ${text}`);
  }

  const json: ApiResponse<Board> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(`Failed to create board: ${json.error}`);
  }

  return json.data;
}

/**
 * Delete a board via DELETE /api/boards/:id
 * This cascades to delete all horses, feeds, and diet entries
 */
export async function deleteBoard(
  request: APIRequestContext,
  boardId: string
): Promise<void> {
  const response = await request.delete(`${BASE_URL}/api/boards/${boardId}`, {
    headers: TEST_AUTH_HEADERS,
  });

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete board: ${response.status()} ${text}`);
  }
}

/**
 * Get a board via GET /api/boards/:id
 * Returns null if board not found (404)
 */
export async function getBoard(
  request: APIRequestContext,
  boardId: string
): Promise<Board | null> {
  const response = await request.get(`${BASE_URL}/api/boards/${boardId}`, {
    headers: TEST_AUTH_HEADERS,
  });

  if (response.status() === 404) {
    return null;
  }

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to get board: ${response.status()} ${text}`);
  }

  const json: ApiResponse<Board> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(`Failed to get board: ${json.error}`);
  }

  return json.data;
}

// =============================================================================
// HORSE API
// =============================================================================

export interface CreateHorseInput {
  name: string;
  note?: string;
  note_expiry?: string;
}

export interface UpdateHorseInput {
  name?: string;
  note?: string | null;
  note_expiry?: string | null;
  archived?: boolean;
}

/**
 * Create a horse via POST /api/boards/:boardId/horses
 */
export async function createHorse(
  request: APIRequestContext,
  boardId: string,
  input: CreateHorseInput
): Promise<Horse> {
  const response = await request.post(
    `${BASE_URL}/api/boards/${boardId}/horses`,
    {
      data: input,
      headers: TEST_AUTH_HEADERS,
    }
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create horse: ${response.status()} ${text}`);
  }

  const json: ApiResponse<Horse> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(`Failed to create horse: ${json.error}`);
  }

  return json.data;
}

/**
 * Update a horse via PATCH /api/horses/:id
 */
export async function updateHorse(
  request: APIRequestContext,
  horseId: string,
  input: UpdateHorseInput
): Promise<Horse> {
  const response = await request.patch(`${BASE_URL}/api/horses/${horseId}`, {
    data: input,
    headers: TEST_AUTH_HEADERS,
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to update horse: ${response.status()} ${text}`);
  }

  const json: ApiResponse<Horse> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(`Failed to update horse: ${json.error}`);
  }

  return json.data;
}

/**
 * Delete a horse via DELETE /api/horses/:id
 */
export async function deleteHorse(
  request: APIRequestContext,
  horseId: string
): Promise<void> {
  const response = await request.delete(`${BASE_URL}/api/horses/${horseId}`, {
    headers: TEST_AUTH_HEADERS,
  });

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete horse: ${response.status()} ${text}`);
  }
}

// =============================================================================
// FEED API
// =============================================================================

export interface CreateFeedInput {
  name: string;
  unit_type?: 'fraction' | 'int' | 'decimal' | 'choice';
  unit_label?: string;
  entry_options?: string | null;
}

/**
 * Create a feed via POST /api/boards/:boardId/feeds
 */
export async function createFeed(
  request: APIRequestContext,
  boardId: string,
  input: CreateFeedInput
): Promise<Feed> {
  const response = await request.post(
    `${BASE_URL}/api/boards/${boardId}/feeds`,
    {
      data: {
        name: input.name,
        unit_type: input.unit_type,
        unit_label: input.unit_label,
        entry_options: input.entry_options,
      },
      headers: TEST_AUTH_HEADERS,
    }
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create feed: ${response.status()} ${text}`);
  }

  const json: ApiResponse<Feed> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(`Failed to create feed: ${json.error}`);
  }

  return json.data;
}

/**
 * Delete a feed via DELETE /api/feeds/:id
 */
export async function deleteFeed(
  request: APIRequestContext,
  feedId: string
): Promise<void> {
  const response = await request.delete(`${BASE_URL}/api/feeds/${feedId}`, {
    headers: TEST_AUTH_HEADERS,
  });

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete feed: ${response.status()} ${text}`);
  }
}

// =============================================================================
// DIET API
// =============================================================================

export interface UpsertDietInput {
  horse_id: string;
  feed_id: string;
  am_amount?: number | null;
  pm_amount?: number | null;
  am_variant?: string | null;
  pm_variant?: string | null;
}

/**
 * Upsert a diet entry via PUT /api/diet
 */
export async function upsertDiet(
  request: APIRequestContext,
  input: UpsertDietInput
): Promise<DietEntry> {
  const response = await request.put(`${BASE_URL}/api/diet`, {
    data: input,
    headers: TEST_AUTH_HEADERS,
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to upsert diet: ${response.status()} ${text}`);
  }

  const json: ApiResponse<DietEntry> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(`Failed to upsert diet: ${json.error}`);
  }

  return json.data;
}

/**
 * Delete a diet entry via DELETE /api/diet/:horse_id/:feed_id
 */
export async function deleteDiet(
  request: APIRequestContext,
  horseId: string,
  feedId: string
): Promise<void> {
  const response = await request.delete(
    `${BASE_URL}/api/diet/${horseId}/${feedId}`,
    {
      headers: TEST_AUTH_HEADERS,
    }
  );

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete diet: ${response.status()} ${text}`);
  }
}
