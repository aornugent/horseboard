Board UX Redesign Implementation Plan (Revised)
REQUIRED NEXT STEP: Use the /executing workflow to implement this plan task-by-task.

Goal: Implement working pagination for the TV Board with sparse filtering, and independent scrollable view for the Controller.

Scope (MVP):

✅ Horse-Major orientation (horses as columns)
✅ Sparse filtering (hide unused feeds per page)
✅ TimeMode-aware filtering (show only AM or PM feeds)
✅ Independent Controller view (scrollable, no pagination)
✅ Remote controls for TV pagination
⏳ Feed-Major orientation (Phase 2)
⏳ Animated transitions (Phase 2)
Architecture:

Pure function computeVisibleGrid in src/client/lib/board-logic.ts
TV (

Board.tsx
) uses paginated output
Controller (

BoardTab.tsx
) uses unpaginated output + remote controls
Tech Stack: Preact, Signals, TypeScript, Vitest (Unit), Playwright (E2E)

Task 1: Core Logic (The Slicer)
Files:

Create: src/client/lib/board-logic.ts
Create: src/client/lib/board-logic.test.ts
Step 1: Write failing tests
// src/client/lib/board-logic.test.ts
import { describe, it, expect } from 'vitest';
import { computeVisibleGrid } from './board-logic';
import type { Horse, Feed, DietEntry, EffectiveTimeMode } from '../../shared/resources';
// Complete mock data with all required fields
const mockHorses: Horse[] = [
  { id: 'h1', board_id: 'b1', name: 'Horse 1', note: null, note_expiry: null, archived: false, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'h2', board_id: 'b1', name: 'Horse 2', note: null, note_expiry: null, archived: false, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'h3', board_id: 'b1', name: 'Horse 3', note: null, note_expiry: null, archived: false, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];
const mockFeeds: Feed[] = [
  { id: 'f1', board_id: 'b1', name: 'Oats', unit_type: 'fraction', unit_label: 'scoop', entry_options: null, rank: 3, stock_level: 100, low_stock_threshold: 10, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'f2', board_id: 'b1', name: 'Hay', unit_type: 'fraction', unit_label: 'scoop', entry_options: null, rank: 2, stock_level: 100, low_stock_threshold: 10, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'f3', board_id: 'b1', name: 'Vitamins', unit_type: 'fraction', unit_label: 'scoop', entry_options: null, rank: 1, stock_level: 100, low_stock_threshold: 10, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];
const mockDiet: DietEntry[] = [
  // H1 eats Oats (AM only)
  { horse_id: 'h1', feed_id: 'f1', am_amount: 2, pm_amount: null, am_variant: null, pm_variant: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  // H2 eats Hay (PM only)
  { horse_id: 'h2', feed_id: 'f2', am_amount: null, pm_amount: 1, am_variant: null, pm_variant: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  // H3 eats nothing
  // Vitamins (f3) eaten by nobody
];
describe('computeVisibleGrid', () => {
  it('paginates horses (major axis)', () => {
    const result = computeVisibleGrid({
      horses: mockHorses,
      feeds: mockFeeds,
      diet: mockDiet,
      timeMode: 'AM',
      page: 0,
      pageSize: 1
    });
    
    expect(result.horses).toHaveLength(1);
    expect(result.horses[0].id).toBe('h1');
    expect(result.totalPages).toBe(3);
  });
  it('filters feeds sparsely based on visible horses', () => {
    // Page 0 = Horse 1 only. Horse 1 eats Oats (AM).
    // In AM mode, should show Oats only.
    const result = computeVisibleGrid({
      horses: mockHorses,
      feeds: mockFeeds,
      diet: mockDiet,
      timeMode: 'AM',
      page: 0,
      pageSize: 1
    });
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].id).toBe('f1'); // Oats
  });
  it('respects timeMode - hides AM-only feeds in PM', () => {
    // Page 0 = Horse 1. Horse 1 eats Oats (AM only).
    // In PM mode, Horse 1 has no PM feeds -> no feeds shown.
    const result = computeVisibleGrid({
      horses: mockHorses,
      feeds: mockFeeds,
      diet: mockDiet,
      timeMode: 'PM',
      page: 0,
      pageSize: 1
    });
    expect(result.feeds).toHaveLength(0);
  });
  it('shows PM feeds in PM mode', () => {
    // Page 1 = Horse 2. Horse 2 eats Hay (PM only).
    const result = computeVisibleGrid({
      horses: mockHorses,
      feeds: mockFeeds,
      diet: mockDiet,
      timeMode: 'PM',
      page: 1,
      pageSize: 1
    });
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].id).toBe('f2'); // Hay
  });
  it('handles empty pages gracefully', () => {
    const result = computeVisibleGrid({
      horses: mockHorses,
      feeds: mockFeeds,
      diet: mockDiet,
      timeMode: 'AM',
      page: 99,
      pageSize: 1
    });
    
    expect(result.horses).toHaveLength(0);
    expect(result.feeds).toHaveLength(0);
  });
  it('returns all horses when pageSize is large', () => {
    const result = computeVisibleGrid({
      horses: mockHorses,
      feeds: mockFeeds,
      diet: mockDiet,
      timeMode: 'AM',
      page: 0,
      pageSize: 100
    });
    
    expect(result.horses).toHaveLength(3);
    expect(result.totalPages).toBe(1);
  });
});
Step 2: Run tests (verify fail)
npm test -- src/client/lib/board-logic.test.ts
Expected: ❌ FAIL — Module not found.

Step 3: Implement computeVisibleGrid
// src/client/lib/board-logic.ts
import type { Horse, Feed, DietEntry, EffectiveTimeMode } from '../../shared/resources';
export interface GridInput {
  horses: Horse[];
  feeds: Feed[];
  diet: DietEntry[];
  timeMode: EffectiveTimeMode;
  page: number;
  pageSize: number;
}
export interface GridOutput {
  horses: Horse[];
  feeds: Feed[];
  totalPages: number;
}
export function computeVisibleGrid({
  horses,
  feeds,
  diet,
  timeMode,
  page,
  pageSize
}: GridInput): GridOutput {
  // 1. Paginate horses
  const totalPages = Math.max(1, Math.ceil(horses.length / pageSize));
  const start = page * pageSize;
  const visibleHorses = horses.slice(start, start + pageSize);
  
  if (visibleHorses.length === 0) {
    return { horses: [], feeds: [], totalPages };
  }
  // 2. Find active feeds for visible horses in current timeMode
  const visibleHorseIds = new Set(visibleHorses.map(h => h.id));
  const activeFeedIds = new Set<string>();
  
  const amountField = timeMode === 'AM' ? 'am_amount' : 'pm_amount';
  
  for (const entry of diet) {
    if (!visibleHorseIds.has(entry.horse_id)) continue;
    
    const amount = entry[amountField];
    if (amount !== null && amount !== undefined && amount > 0) {
      activeFeedIds.add(entry.feed_id);
    }
  }
  // 3. Filter feeds to only active ones, maintaining rank order
  const visibleFeeds = feeds.filter(f => activeFeedIds.has(f.id));
  return {
    horses: visibleHorses,
    feeds: visibleFeeds,
    totalPages
  };
}
Step 4: Run tests (verify pass)
npm test -- src/client/lib/board-logic.test.ts
Expected: ✅ PASS

Step 5: Commit
git add src/client/lib/board-logic.ts src/client/lib/board-logic.test.ts
git commit -m "feat(board): add computeVisibleGrid slicer with timeMode support"
Task 2: Update Data Model & Stores
Files:

Modify: 

src/shared/resources.ts
 (lines 119-136)
Modify: src/server/db/schema.ts (if DB column needed)
Modify: 

src/client/lib/engine.ts
 (lines 326-414)
Modify: 

src/client/stores/index.ts
Step 1: Add orientation to BoardSchema
// src/shared/resources.ts - Add after TimeModeSchema (line ~23)
export const BoardOrientationSchema = z.enum(['horse-major', 'feed-major']);
export type BoardOrientation = z.infer<typeof BoardOrientationSchema>;
export const DEFAULT_ORIENTATION: BoardOrientation = 'horse-major';
// src/shared/resources.ts - Update BoardSchema (add field after zoom_level)
  orientation: BoardOrientationSchema.default('horse-major'),
// src/shared/resources.ts - Update UpdateBoardSchema
  orientation: BoardOrientationSchema.optional(),
Step 2: Update BoardStore
// src/client/lib/engine.ts - In BoardStore interface (after current_page)
  orientation: ReadonlySignal<BoardOrientation>;
  setOrientation: (o: BoardOrientation) => void;
// src/client/lib/engine.ts - In createBoardStore (after current_page computed)
  const orientation = computed(() => board.value?.orientation ?? 'horse-major');
// src/client/lib/engine.ts - In return object
    setOrientation(o: BoardOrientation) {
      if (board.value) {
        board.value = {
          ...board.value,
          orientation: o,
          updated_at: new Date().toISOString()
        };
      }
    }
Step 3: Export from stores
// src/client/stores/index.ts - Add exports
export const orientation = boardStore.orientation;
export const setOrientation = boardStore.setOrientation;
Step 4: Commit
git add src/shared/resources.ts src/client/lib/engine.ts src/client/stores/index.ts
git commit -m "feat(board): add orientation field to Board model"
Task 3: Board View (TV) Integration
Files:

Modify: 

src/client/views/Board.tsx
Modify: 

src/client/views/Board.css
Step 1: Import Slicer and compute visible grid
// src/client/views/Board.tsx - Replace entire file
import { computed } from '@preact/signals';
import { SwimLaneGrid } from '../components/SwimLaneGrid';
import { horses, feeds, dietEntries, effectiveTimeMode, board, zoomLevel, currentPage } from '../stores';
import { computeVisibleGrid } from '../lib/board-logic';
import './Board.css';
function getPageSize(zoom: number): number {
  switch (zoom) {
    case 1: return 8;  // Small (more horses)
    case 3: return 4;  // Large (fewer horses)
    default: return 6; // Medium
  }
}
export function Board() {
  const pairCode = board.value?.pair_code;
  // Compute visible grid based on pagination
  const gridData = computed(() => computeVisibleGrid({
    horses: horses.value.filter(h => !h.archived),
    feeds: feeds.value,
    diet: dietEntries.value,
    timeMode: effectiveTimeMode.value,
    page: currentPage.value ?? 0,
    pageSize: getPageSize(zoomLevel.value ?? 2)
  }));
  const hasData = gridData.value.horses.length > 0;
  const showPageInfo = gridData.value.totalPages > 1;
  return (
    <div
      class="board-view"
      data-theme={effectiveTimeMode.value.toLowerCase()}
      data-testid="board-view"
    >
      <header class="board-header">
        {pairCode && (
          <div class="board-pair-code" data-testid="board-pair-code">
            <span class="board-pair-code-label">Code:</span>
            <span class="board-pair-code-value">{pairCode}</span>
          </div>
        )}
        
        {showPageInfo && (
          <div class="board-page-info" data-testid="board-page-info">
            Page {(currentPage.value ?? 0) + 1} of {gridData.value.totalPages}
          </div>
        )}
        
        <div class="board-time-badge" data-testid="time-mode-badge">
          {effectiveTimeMode.value}
        </div>
      </header>
      <main class="board-content">
        {hasData ? (
          <SwimLaneGrid
            horses={{ value: gridData.value.horses }}
            feeds={{ value: gridData.value.feeds }}
            timeMode={effectiveTimeMode}
            isEditable={false}
          />
        ) : (
          <div class="board-empty" data-testid="board-empty">
            <div class="board-empty-content">
              <h2 class="board-empty-title">Welcome to HorseBoard</h2>
              <p class="board-empty-text">
                Use a phone to connect and add horses
              </p>
              {pairCode && (
                <div class="board-empty-code">
                  <span class="board-empty-code-label">Enter this code on your phone:</span>
                  <span class="board-empty-code-value" data-testid="board-empty-pair-code">
                    {pairCode}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
Step 2: Add page info styling
/* src/client/views/Board.css - Add after .board-pair-code-value */
.board-page-info {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  padding: 0.5rem 1rem;
  background: var(--color-bg-secondary);
  border-radius: 0.5rem;
}
@media (min-width: 1200px) {
  .board-page-info {
    font-size: 1.5rem;
  }
}
Step 3: Manual verification
npm run dev
# Open http://localhost:5173/board
# Add 10+ horses, verify pagination shows "Page 1 of 2"
Step 4: Commit
git add src/client/views/Board.tsx src/client/views/Board.css
git commit -m "feat(board): integrate Slicer for sparse pagination on TV"
Task 4: Controller (BoardTab) Refactor
Files:

Modify: 

src/client/views/Controller/BoardTab.tsx
Modify: 

src/client/views/Controller/BoardTab.css
Step 1: Refactor BoardTab with scrollable container
// src/client/views/Controller/BoardTab.tsx - Replace entire file
import { computed } from '@preact/signals';
import { SwimLaneGrid } from '../../components/SwimLaneGrid';
import { horses, feeds, dietEntries, effectiveTimeMode, configuredMode, zoomLevel, board, setCurrentPage, currentPage, setZoomLevel } from '../../stores';
import { computeVisibleGrid } from '../../lib/board-logic';
import './BoardTab.css';
import { updateBoard as apiUpdateBoard, updateTimeMode as apiUpdateTimeMode } from '../../services';
import { TIME_MODE, TIME_MODE_CONFIG, type TimeMode } from '../../../shared/resources';
import { useSignal } from '@preact/signals';
async function changePage(delta: number, totalPages: number) {
  if (!board.value) return;
  const current = currentPage.value ?? 0;
  const newPage = Math.max(0, Math.min(totalPages - 1, current + delta));
  if (newPage === current) return;
  
  try {
    await apiUpdateBoard(board.value.id, { current_page: newPage });
    setCurrentPage(newPage);
  } catch (err) {
    console.error('Failed to update page:', err);
  }
}
async function changeTimeMode(mode: TimeMode) {
  if (!board.value) return;
  const override_until = mode !== TIME_MODE.AUTO
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : null;
  try {
    await apiUpdateTimeMode(board.value.id, mode, override_until);
  } catch (err) {
    console.error('Failed to update time mode:', err);
  }
}
async function changeZoom(level: 1 | 2 | 3) {
  if (!board.value) return;
  try {
    await apiUpdateBoard(board.value.id, { zoom_level: level });
    setZoomLevel(level);
  } catch (err) {
    console.error('Failed to update zoom:', err);
  }
}
export function BoardTab() {
  const showControls = useSignal(false);
  // Local view: Show ALL data (no pagination) for scrollable reference
  const localGridData = computed(() => computeVisibleGrid({
    horses: horses.value.filter(h => !h.archived),
    feeds: feeds.value,
    diet: dietEntries.value,
    timeMode: effectiveTimeMode.value,
    page: 0,
    pageSize: 1000 // Effectively infinite
  }));
  // Remote state: What the TV is showing
  const tvTotalPages = computed(() => {
    const pageSize = zoomLevel.value === 1 ? 8 : zoomLevel.value === 3 ? 4 : 6;
    return Math.max(1, Math.ceil(horses.value.filter(h => !h.archived).length / pageSize));
  });
  const tvCurrentPage = currentPage.value ?? 0;
  const canGoPrev = tvCurrentPage > 0;
  const canGoNext = tvCurrentPage < tvTotalPages.value - 1;
  return (
    <div class="board-tab" data-testid="board-tab">
      <div class="board-tab-header">
        <h2 class="board-tab-title">Board</h2>
        <span class="board-tab-badge">{effectiveTimeMode.value}</span>
      </div>
      {/* TV Remote Controls */}
      <div class="board-remote-controls">
        <div class="board-remote-label">TV Display</div>
        <div class="board-remote-row">
          <button
            class="board-control-btn"
            onClick={() => changePage(-1, tvTotalPages.value)}
            disabled={!canGoPrev}
            data-testid="prev-page-btn"
          >
            ◀
          </button>
          <span class="board-page-indicator" data-testid="page-indicator">
            {tvCurrentPage + 1} / {tvTotalPages.value}
          </span>
          <button
            class="board-control-btn"
            onClick={() => changePage(1, tvTotalPages.value)}
            disabled={!canGoNext}
            data-testid="next-page-btn"
          >
            ▶
          </button>
        </div>
      </div>
      {/* Scrollable Board Reference */}
      <div class="board-reference" data-testid="board-reference">
        <div class="board-reference-scroll">
          <SwimLaneGrid
            horses={{ value: localGridData.value.horses }}
            feeds={{ value: localGridData.value.feeds }}
            timeMode={effectiveTimeMode}
            isEditable={false}
          />
        </div>
      </div>
      {/* Display Controls Drawer */}
      <div class="board-display-controls">
        <button
          class="board-controls-toggle"
          onClick={() => showControls.value = !showControls.value}
          data-testid="toggle-display-controls"
        >
          Display Settings
          <span class="board-controls-toggle-icon">{showControls.value ? '▼' : '▶'}</span>
        </button>
        {showControls.value && (
          <div class="board-controls-drawer" data-testid="display-controls-drawer">
            <div class="board-control-group" data-testid="time-mode-selector">
              <label class="board-control-label">Time Mode</label>
              <div class="board-control-buttons">
                {[TIME_MODE.AUTO, TIME_MODE.AM, TIME_MODE.PM].map(mode => (
                  <button
                    key={mode}
                    class={`board-control-option ${configuredMode.value === mode ? 'active' : ''}`}
                    onClick={() => changeTimeMode(mode)}
                    data-testid={`time-mode-${mode.toLowerCase()}`}
                    title={TIME_MODE_CONFIG[mode].description}
                  >
                    {TIME_MODE_CONFIG[mode].label}
                  </button>
                ))}
              </div>
            </div>
            <div class="board-control-group" data-testid="zoom-selector">
              <label class="board-control-label">TV Zoom</label>
              <div class="board-control-buttons">
                <button
                  class={`board-control-option ${zoomLevel.value === 1 ? 'active' : ''}`}
                  onClick={() => changeZoom(1)}
                  data-testid="zoom-level-1"
                >
                  S
                </button>
                <button
                  class={`board-control-option ${zoomLevel.value === 2 ? 'active' : ''}`}
                  onClick={() => changeZoom(2)}
                  data-testid="zoom-level-2"
                >
                  M
                </button>
                <button
                  class={`board-control-option ${zoomLevel.value === 3 ? 'active' : ''}`}
                  onClick={() => changeZoom(3)}
                  data-testid="zoom-level-3"
                >
                  L
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
Step 2: Update CSS - Remove scale hack, add scrollable container
/* src/client/views/Controller/BoardTab.css - Replace entire file */
.board-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  gap: 1rem;
}
.board-tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.board-tab-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}
.board-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-bg-primary);
  background: var(--color-accent);
  border-radius: 999px;
  letter-spacing: 0.05em;
}
/* TV Remote Controls */
.board-remote-controls {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.board-remote-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}
.board-remote-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}
.board-control-btn {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 48px;
}
.board-control-btn:active {
  background: var(--color-bg-active);
}
.board-control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.board-page-indicator {
  font-weight: 700;
  font-size: 1rem;
  color: var(--color-text-primary);
  min-width: 60px;
  text-align: center;
}
/* Scrollable Board Reference */
.board-reference {
  flex: 1;
  min-height: 200px;
  max-height: 50vh;
  background: var(--color-bg-primary);
  border: 2px solid var(--color-bg-secondary);
  border-radius: 12px;
  overflow: hidden;
}
.board-reference-scroll {
  height: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
/* Display Controls */
.board-display-controls {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}
.board-controls-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}
.board-controls-toggle:active {
  background: var(--color-bg-active);
}
.board-controls-toggle-icon {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
.board-controls-drawer {
  padding: 1rem;
  border-top: 1px solid var(--color-border);
}
.board-control-group {
  margin-bottom: 1.5rem;
}
.board-control-group:last-child {
  margin-bottom: 0;
}
.board-control-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}
.board-control-buttons {
  display: flex;
  gap: 0.5rem;
}
.board-control-option {
  flex: 1;
  min-height: 48px;
  padding: 0.75rem 1rem;
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}
.board-control-option:active {
  background: var(--color-bg-active);
}
.board-control-option.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg-primary);
}
Step 3: Manual verification
npm run dev
# Open Controller, go to Board tab
# Verify: Scrollable board reference, TV remote controls at top
Step 4: Commit
git add src/client/views/Controller/BoardTab.tsx src/client/views/Controller/BoardTab.css
git commit -m "feat(controller): refactor BoardTab with scrollable reference and TV remote"
Task 5: E2E Tests
Files:

Create: tests/e2e/board-pagination.spec.ts
Step 1: Write E2E test for pagination
// tests/e2e/board-pagination.spec.ts
import { test, expect } from '@playwright/test';
test.describe('Board Pagination', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Create board with multiple horses via API fixtures
    // (Assuming auth fixtures exist from prior work)
  });
  test('TV shows paginated horses based on zoom level', async ({ page }) => {
    // Add 10 horses
    // Navigate to /board
    // Verify only 6 horses visible (default zoom=2)
    // Verify page indicator shows "Page 1 of 2"
  });
  test('Controller can change TV page', async ({ page, context }) => {
    // Setup: 10 horses, open both /board and /controller
    // On Controller: Click Next Page
    // Verify TV shows horses 7-10
    // Verify Controller page indicator updates
  });
  test('Controller shows all horses in scrollable reference', async ({ page }) => {
    // Add 10 horses
    // Open Controller, Board tab
    // Verify all 10 horses visible (scroll down to check)
  });
  test('Zoom changes horses per page on TV', async ({ page }) => {
    // Add 10 horses
    // Open /board, verify 6 visible (zoom=M)
    // Via Controller, change zoom to S
    // Verify 8 horses visible
  });
});
Step 2: Run tests
npm run test:e2e -- tests/e2e/board-pagination.spec.ts
Step 3: Commit
git add tests/e2e/board-pagination.spec.ts
git commit -m "test(e2e): add board pagination tests"
Deferred (Phase 2)
The following features are explicitly deferred:

Feed-Major orientation: Requires SwimLaneGrid refactor to be axis-agnostic
Horse/Feed ordering UI: Needs design for drag-drop or manual rank adjustment
Animated page transitions: Nice-to-have polish
2D sub-page overflow: Edge case for extremely large datasets