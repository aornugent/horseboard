/**
 * E2E Test Setup Helpers
 *
 * Functions for setting up test data and browser state.
 * Each test should use these to create isolated test data.
 */

import { Page, APIRequestContext } from '@playwright/test';
import {
  createBoard,
  createHorse,
  createFeed,
  upsertDiet,
  deleteBoard,
  type Board,
  type Horse,
  type Feed,
  type DietEntry,
} from './api';

// Storage key used by the app (from App.tsx)
const STORAGE_KEY = 'hb_board_id';

// =============================================================================
// TYPES
// =============================================================================

export interface TestData {
  board: Board;
  horses: Horse[];
  feeds: Feed[];
  dietEntries: DietEntry[];
}

export interface SeedOptions {
  horseCount?: number;
  feedCount?: number;
  createDietEntries?: boolean;
}

// =============================================================================
// SETUP FUNCTIONS
// =============================================================================

/**
 * Create a board via API and prepare localStorage.
 * Returns the board - use injectBoardId() to set it in the page.
 *
 * Usage:
 * ```ts
 * const board = await setupBoard(page, request);
 * await page.goto('/controller');
 * await injectBoardId(page, board.id);
 * await page.reload();
 * ```
 *
 * Or use seedTestData() which handles this automatically.
 */
export async function setupBoard(
  page: Page,
  request: APIRequestContext
): Promise<Board> {
  const board = await createBoard(request);
  return board;
}

/**
 * Inject board ID into localStorage and reload the page.
 * Call this after navigating to the app.
 */
export async function injectBoardId(
  page: Page,
  boardId: string
): Promise<void> {
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: boardId }
  );
}

/**
 * Seed a minimal test dataset.
 * Creates a board with horses, feeds, and optionally diet entries.
 *
 * Default seed:
 * - 2 horses: "Thunder", "Lightning"
 * - 2 feeds: "Oats" (scoop), "Hay" (biscuit)
 * - Diet entries linking all horses to all feeds
 *
 * Note: After calling this, navigate to a page and the data will be loaded
 * via the navigateWithBoard helper.
 *
 * Usage:
 * ```ts
 * const data = await seedTestData(page, request);
 * await navigateWithBoard(page, '/controller', data.board.id);
 * // data.horses[0].name === 'Thunder'
 * ```
 */
export async function seedTestData(
  page: Page,
  request: APIRequestContext,
  options: SeedOptions = {}
): Promise<TestData> {
  const {
    horseCount = 2,
    feedCount = 2,
    createDietEntries = true,
  } = options;

  // Create board via API
  const board = await setupBoard(page, request);

  // Create horses
  const defaultHorseNames = ['Thunder', 'Lightning', 'Storm', 'Blaze', 'Shadow'];
  const horses: Horse[] = [];

  for (let i = 0; i < horseCount; i++) {
    const name = defaultHorseNames[i] || `Horse ${i + 1}`;
    const horse = await createHorse(request, board.id, { name });
    horses.push(horse);
  }

  // Create feeds
  const defaultFeeds = [
    { name: 'Oats', unit_type: 'fraction' as const, unit_label: 'scoop' },
    { name: 'Hay', unit_type: 'int' as const, unit_label: 'biscuit' },
    { name: 'Supplements', unit_type: 'int' as const, unit_label: 'tablet' },
    { name: 'Water', unit_type: 'decimal' as const, unit_label: 'ml' },
  ];
  const feeds: Feed[] = [];

  for (let i = 0; i < feedCount; i++) {
    const feedData = defaultFeeds[i] || { name: `Feed ${i + 1}`, unit_type: 'fraction' as const, unit_label: 'scoop' };
    const feed = await createFeed(request, board.id, feedData);
    feeds.push(feed);
  }

  // Create diet entries (all horses get all feeds)
  const dietEntries: DietEntry[] = [];

  if (createDietEntries && horses.length > 0 && feeds.length > 0) {
    for (const horse of horses) {
      for (const feed of feeds) {
        const entry = await upsertDiet(request, {
          horse_id: horse.id,
          feed_id: feed.id,
          am_amount: 1,
          pm_amount: 1.5,
        });
        dietEntries.push(entry);
      }
    }
  }

  return {
    board,
    horses,
    feeds,
    dietEntries,
  };
}

/**
 * Clean up test data by deleting the board.
 * Cascade delete removes all horses, feeds, and diet entries.
 *
 * Usage (in afterEach):
 * ```ts
 * await cleanupTestData(request, testData.board.id);
 * ```
 */
export async function cleanupTestData(
  request: APIRequestContext,
  boardId: string
): Promise<void> {
  await deleteBoard(request, boardId);
}

/**
 * Clear localStorage board ID from the page.
 * Useful for testing pairing flows.
 */
export async function clearBoardFromStorage(page: Page): Promise<void> {
  await page.evaluate(
    ({ key }) => {
      localStorage.removeItem(key);
    },
    { key: STORAGE_KEY }
  );
}

// Storage key for permission (from api.ts)
const PERMISSION_KEY = 'hb_permission';

/**
 * Navigate to a page with the board ID set in localStorage.
 * This is the recommended way to navigate after seeding data.
 *
 * @param permission - Permission level to set in localStorage (default: 'admin' for owner fixtures)
 */
export async function navigateWithBoard(
  page: Page,
  path: string,
  boardId: string,
  permission: 'view' | 'edit' | 'admin' = 'admin'
): Promise<void> {
  // First navigate to the base URL to have access to localStorage
  await page.goto('/');

  // Set the board ID in localStorage
  await injectBoardId(page, boardId);

  // Set the permission in localStorage (admin for owner fixtures)
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: PERMISSION_KEY, value: permission }
  );

  // Now navigate to the actual destination
  await page.goto(path);
}

// =============================================================================
// WAIT HELPERS
// =============================================================================

/**
 * Wait for the controller view to be ready with data loaded.
 * Use after seeding data and navigating to /controller.
 */
export async function waitForControllerReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="controller-view"]', {
    state: 'visible',
    timeout: 8000,
  });

  // Wait for data hydration - either cards or empty state
  await page.waitForSelector('.horse-card, [data-testid="horse-list-empty"]', {
    state: 'visible',
    timeout: 5000,
  });
}

/**
 * Wait for the board view to be ready with data loaded.
 * Use after seeding data and navigating to /board.
 */
export async function waitForBoardReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="board-view"]', {
    state: 'visible',
    timeout: 8000,
  });

  // Wait for grid to render
  await page.waitForSelector('[data-testid="swim-lane-grid"]', {
    state: 'visible',
    timeout: 5000,
  });
}
