/**
 * E2E Test API Helpers
 *
 * Functions for creating and managing test data via the API.
 * These helpers allow tests to seed their own isolated data.
 */

import { APIRequestContext } from '@playwright/test';
import type { Unit } from '../../../src/shared/resources';

// API base URL (matches playwright.config.ts)
const BASE_URL = 'http://localhost:5173';

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
  unit: Unit;
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
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
  const response = await request.delete(`${BASE_URL}/api/boards/${boardId}`);

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete board: ${response.status()} ${text}`);
  }
}

// =============================================================================
// HORSE API
// =============================================================================

export interface CreateHorseInput {
  name: string;
  note?: string;
  note_expiry?: string;
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
 * Delete a horse via DELETE /api/horses/:id
 */
export async function deleteHorse(
  request: APIRequestContext,
  horseId: string
): Promise<void> {
  const response = await request.delete(`${BASE_URL}/api/horses/${horseId}`);

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
  unit: Unit;
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
      data: input,
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
  const response = await request.delete(`${BASE_URL}/api/feeds/${feedId}`);

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
    `${BASE_URL}/api/diet/${horseId}/${feedId}`
  );

  if (!response.ok() && response.status() !== 404) {
    const text = await response.text();
    throw new Error(`Failed to delete diet: ${response.status()} ${text}`);
  }
}
