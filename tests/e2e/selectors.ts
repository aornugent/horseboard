/**
 * E2E Test Selectors
 *
 * Centralized data-testid selectors for Playwright tests.
 * These selectors are stable and won't break when CSS classes change.
 */

export const selectors = {
  // ============================================
  // SwimLaneGrid (TV Display Grid)
  // ============================================
  swimLaneGrid: '[data-testid="swim-lane-grid"]',
  gridHeader: '[data-testid="grid-header"]',
  gridFooter: '[data-testid="grid-footer"]',

  // Dynamic grid selectors
  horseHeader: (id: string) => `[data-testid="horse-header-${id}"]`,
  feedRow: (id: string) => `[data-testid="feed-row-${id}"]`,
  feedName: (id: string) => `[data-testid="feed-name-${id}"]`,
  cell: (horseId: string, feedId: string) => `[data-testid="cell-${horseId}-${feedId}"]`,
  badge: (horseId: string, feedId: string) => `[data-testid="badge-${horseId}-${feedId}"]`,
  note: (id: string) => `[data-testid="note-${id}"]`,

  // ============================================
  // FeedPad (Touch-Friendly Input Drawer)
  // ============================================
  feedPad: '[data-testid="feed-pad"]',
  feedPadClose: '[data-testid="feed-pad-close"]',
  feedPadCurrent: '[data-testid="feed-pad-current"]',
  feedPadPresets: '[data-testid="feed-pad-presets"]',
  presetEmpty: '[data-testid="preset-empty"]',
  presetHalf: '[data-testid="preset-half"]',
  presetOne: '[data-testid="preset-one"]',
  presetTwo: '[data-testid="preset-two"]',
  feedPadStepper: '[data-testid="feed-pad-stepper"]',
  stepperDecrement: '[data-testid="stepper-decrement"]',
  stepperValue: '[data-testid="stepper-value"]',
  stepperIncrement: '[data-testid="stepper-increment"]',
  feedPadConfirm: '[data-testid="feed-pad-confirm"]',

  // ============================================
  // HorseCard (Mobile List Item)
  // ============================================
  horseCard: (id: string) => `[data-testid="horse-card-${id}"]`,
  horseCardName: (id: string) => `[data-testid="horse-card-name-${id}"]`,
  horseCardSummary: (id: string) => `[data-testid="horse-card-summary-${id}"]`,
  horseCardNote: (id: string) => `[data-testid="horse-card-note-${id}"]`,

  // ============================================
  // HorsesTab (Mobile Controller - Horses List)
  // ============================================
  horsesTab: '[data-testid="horses-tab"]',
  horseSearch: '[data-testid="horse-search"]',
  horseList: '[data-testid="horse-list"]',
  horseListEmpty: '[data-testid="horse-list-empty"]',

  // ============================================
  // HorseDetail (Mobile Controller - Horse Detail)
  // ============================================
  horseDetail: '[data-testid="horse-detail"]',
  horseDetailBack: '[data-testid="horse-detail-back"]',
  horseDetailName: '[data-testid="horse-detail-name"]',
  horseDetailNote: '[data-testid="horse-detail-note"]',
  feedTiles: '[data-testid="feed-tiles"]',
  feedTile: (id: string) => `[data-testid="feed-tile-${id}"]`,
  feedTileAM: (id: string) => `[data-testid="feed-tile-am-${id}"]`,
  feedTilePM: (id: string) => `[data-testid="feed-tile-pm-${id}"]`,

  // ============================================
  // BoardTab (Mobile Controller - TV Preview)
  // ============================================
  boardTab: '[data-testid="board-tab"]',

  // ============================================
  // Display View (TV)
  // ============================================
  displayView: '[data-testid="display-view"]',
  timeModeBadge: '[data-testid="time-mode-badge"]',

  // ============================================
  // General / Navigation
  // ============================================
  timeMode: (mode: string) => `[data-testid="time-mode-${mode}"]`,
  pairingCode: '[data-testid="pairing-code"]',
  codeInput: (index: number) => `[data-testid="code-input-${index}"]`,
  connectBtn: '[data-testid="connect-btn"]',
  quantityModal: '[data-testid="quantity-modal"]',
  quantityInput: '[data-testid="quantity-input"]',
};

/**
 * Migration Checklist for Playwright Tests
 *
 * | Test File           | Old Selector                     | New Selector                          |
 * |---------------------|----------------------------------|---------------------------------------|
 * | display.spec.js     | .grid-cell.header.horse-name     | selectors.horseHeader(id)             |
 * | display.spec.js     | .grid-cell.value                 | selectors.cell(horseId, feedId)       |
 * | display.spec.js     | .grid-cell.feed-name             | selectors.feedName(id)                |
 * | display.spec.js     | .grid-cell.note                  | selectors.note(id)                    |
 * | controller.spec.js  | .grid-cell.value (keypad)        | selectors.feedPad + preset/stepper    |
 * | controller.spec.js  | .code-digit[data-index="N"]      | selectors.codeInput(N)                |
 * | controller.spec.js  | .mode-btn[data-mode="..."]       | selectors.timeMode(mode)              |
 * | workflows.spec.js   | .grid-cell.feed-name             | selectors.feedName(id)                |
 * | workflows.spec.js   | .grid-cell.note                  | selectors.note(id)                    |
 */
