/**
 * E2E Test Selectors
 *
 * Centralized data-testid selectors for Playwright tests.
 * These selectors are stable and won't break when CSS classes change.
 *
 * Uses shared constants from resources.ts to ensure selectors stay
 * in sync with component implementation.
 */

import { TIME_MODES, type TimeMode } from '../../src/shared/resources';

// Valid unit IDs for testing iteration
const UNITS = ['scoop', 'ml', 'biscuit'] as const;

// =============================================================================
// STATIC SELECTORS
// =============================================================================

export const selectors = {
  // ============================================
  // Tab Navigation (Controller)
  // ============================================
  tabHorses: '[data-testid="tab-horses"]',
  tabFeeds: '[data-testid="tab-feeds"]',
  tabBoard: '[data-testid="tab-board"]',
  tabSettings: '[data-testid="tab-settings"]',

  // ============================================
  // SwimLaneGrid (TV Board Grid)
  // ============================================
  swimLaneGrid: '[data-testid="swim-lane-grid"]',
  gridHeader: '[data-testid="grid-header"]',
  gridFooter: '[data-testid="grid-footer"]',

  // Dynamic grid selectors (updated for axis-agnostic grid)
  // Note: colId/rowId depend on orientation - in horse-major: col=horse, row=feed
  columnHeader: (colId: string) => `[data-testid="column-header-${colId}"]`,
  rowHeader: (rowId: string) => `[data-testid="row-header-${rowId}"]`,
  row: (rowId: string) => `[data-testid="row-${rowId}"]`,
  cell: (colId: string, rowId: string) => `[data-testid="cell-${colId}-${rowId}"]`,
  badge: (colId: string, rowId: string) => `[data-testid="badge-${colId}-${rowId}"]`,
  note: (colId: string) => `[data-testid="note-${colId}"]`,

  // ============================================
  // FeedPad (Touch-Friendly Input Drawer)
  // ============================================
  feedPad: '[data-testid="feed-pad"]',
  feedPadClose: '[data-testid="feed-pad-close"]',
  feedPadCurrent: '[data-testid="feed-pad-current"]',
  feedPadPresets: '[data-testid="feed-pad-presets"]',
  presetEmpty: '[data-testid="preset-empty"]',
  presetHalf: '[data-testid="preset-0.5"]',
  presetOne: '[data-testid="preset-1"]',
  presetTwo: '[data-testid="preset-2"]',
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
  addHorseBtn: '[data-testid="add-horse-btn"]',

  // Add Horse Modal
  addHorseModal: '[data-testid="add-horse-modal"]',
  newHorseName: '[data-testid="new-horse-name"]',
  newHorseNote: '[data-testid="new-horse-note"]',
  cancelAddHorse: '[data-testid="cancel-add-horse"]',
  confirmAddHorse: '[data-testid="confirm-add-horse"]',

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

  // Horse Detail Actions
  editHorseBtn: '[data-testid="edit-horse-btn"]',
  deleteHorseBtn: '[data-testid="delete-horse-btn"]',

  // Edit Horse Modal
  editHorseModal: '[data-testid="edit-horse-modal"]',
  editHorseName: '[data-testid="edit-horse-name"]',
  cancelEditHorse: '[data-testid="cancel-edit-horse"]',
  confirmEditHorse: '[data-testid="confirm-edit-horse"]',

  // Delete Horse Modal
  deleteHorseModal: '[data-testid="delete-horse-modal"]',
  cancelDeleteHorse: '[data-testid="cancel-delete-horse"]',
  confirmDeleteHorse: '[data-testid="confirm-delete-horse"]',

  // ============================================
  // BoardTab (Mobile Controller - TV Preview)
  // ============================================
  boardTab: '[data-testid="board-tab"]',

  // Orientation
  orientationToggle: '[data-testid="orientation-toggle"]',
  orientationHorseMajor: '[data-testid="orientation-horse-major"]',
  orientationFeedMajor: '[data-testid="orientation-feed-major"]',

  // Pagination (new TV Controls drawer)
  boardPageIndicator: '[data-testid="page-indicator"]',
  tvPrevPage: '[data-testid="tv-prev-page"]',
  tvNextPage: '[data-testid="tv-next-page"]',
  // @deprecated - use tvPrevPage/tvNextPage
  prevPageBtn: '[data-testid="prev-page-btn"]',
  nextPageBtn: '[data-testid="next-page-btn"]',
  breadcrumbMore: '[data-testid="breadcrumb-more"]',
  boardReference: '[data-testid="board-reference"]',

  // ============================================
  // FeedsTab (Mobile Controller - Feeds List)
  // ============================================
  feedsTab: '[data-testid="feeds-tab"]',
  feedSearch: '[data-testid="feed-search"]',
  feedList: '[data-testid="feed-list"]',
  feedListEmpty: '[data-testid="feed-list-empty"]',
  addFeedBtn: '[data-testid="add-feed-btn"]',

  // FeedCard
  feedCard: (id: string) => `[data-testid="feed-card-${id}"]`,
  feedCardName: (id: string) => `[data-testid="feed-card-name-${id}"]`,
  feedCardMeta: (id: string) => `[data-testid="feed-card-meta-${id}"]`,
  feedCardDelete: (id: string) => `[data-testid="feed-card-delete-${id}"]`,

  // Feed Modals
  addFeedModal: '[data-testid="add-feed-modal"]',
  editFeedModal: '[data-testid="edit-feed-modal"]',
  deleteFeedModal: '[data-testid="delete-feed-modal"]',
  newFeedName: '[data-testid="new-feed-name"]',
  newFeedUnit: '[data-testid="new-feed-unit"]',
  editFeedName: '[data-testid="edit-feed-name"]',
  editFeedUnit: '[data-testid="edit-feed-unit"]',
  cancelAddFeed: '[data-testid="cancel-add-feed"]',
  confirmAddFeed: '[data-testid="confirm-add-feed"]',
  cancelEditFeed: '[data-testid="cancel-edit-feed"]',
  confirmEditFeed: '[data-testid="confirm-edit-feed"]',
  cancelDeleteFeed: '[data-testid="cancel-delete-feed"]',
  confirmDeleteFeed: '[data-testid="confirm-delete-feed"]',

  // ============================================
  // SettingsTab (Mobile Controller - Settings)
  // ============================================
  settingsTab: '[data-testid="settings-tab"]',
  effectiveTimeMode: '[data-testid="effective-time-mode"]',
  timeModeSelector: '[data-testid="time-mode-selector"]',
  zoomSelector: '[data-testid="zoom-selector"]',
  zoomLevel: (level: number) => `[data-testid="zoom-level-${level}"]`,
  timezoneSelector: '[data-testid="timezone-selector"]',
  boardPairCode: '[data-testid="board-pair-code"]',
  boardId: '[data-testid="board-id"]',
  enterInviteBtn: '[data-testid="enter-invite-btn"]',
  inviteInput: '[data-testid="invite-input"]',
  inviteSubmit: '[data-testid="invite-submit"]',
  inviteError: '[data-testid="invite-error"]',
  generateInviteBtn: '[data-testid="generate-invite-btn"]',

  // Display Management
  addDisplayBtn: '[data-testid="add-display-btn"]',
  linkDisplayModal: '[data-testid="link-display-modal"]',
  provisioningInput: '[data-testid="provisioning-input"]',
  provisioningSubmit: '[data-testid="provisioning-submit"]',
  provisioningError: '[data-testid="provisioning-error"]',
  settingsDeviceName: '[data-testid="settings-device-name"]',
  unlinkDisplayBtn: '[data-testid="unlink-display-btn"]',



  // ============================================
  // Board View (TV)
  // ============================================
  boardView: '[data-testid="board-view"]',
  timeModeBadge: '[data-testid="time-mode-badge"]',
  provisioningView: '[data-testid="provisioning-view"]',
  provisioningCode: '[data-testid="provisioning-code"]',

  // ============================================
  // General / Navigation
  // ============================================
  pairingCode: '[data-testid="pairing-code"]',
  connectBtn: '[data-testid="connect-btn"]',
  quantityModal: '[data-testid="quantity-modal"]',
  quantityInput: '[data-testid="quantity-input"]',


  // ============================================
  // Auth
  // ============================================
  loginView: '[data-testid="login-view"]',
  signupView: '[data-testid="signup-view"]',
  emailInput: '[data-testid="email-input"]',
  passwordInput: '[data-testid="password-input"]',
  nameInput: '[data-testid="name-input"]',
  submitBtn: '[data-testid="submit-btn"]',
  accountName: '[data-testid="account-name"]',
  signOutBtn: '[data-testid="sign-out-btn"]',
};

// =============================================================================
// DYNAMIC SELECTORS DERIVED FROM SHARED CONSTANTS
// These ensure tests stay in sync with component implementation
// =============================================================================

/**
 * Unit button selectors - generated from shared UNITS constant
 * If a unit is renamed in resources.ts, tests using this will fail loudly
 * rather than silently passing with a stale selector.
 */
type UnitId = 'scoop' | 'ml' | 'biscuit';

export const unitSelectors = {
  /** Get selector for a unit button in the add feed modal */
  unitBtn: (unit: UnitId) => `[data-testid="unit-btn-${unit}"]`,
  /** Get selector for a unit button in the edit feed modal */
  editUnitBtn: (unit: UnitId) => `[data-testid="edit-unit-btn-${unit}"]`,
  /** All valid unit values for iteration */
  allUnits: UNITS,
} as const;

/**
 * Time mode selectors - generated from shared TIME_MODES constant
 * If a time mode is renamed in resources.ts, tests using this will fail loudly.
 */
export const timeModeSelectors = {
  /** Get selector for a time mode button */
  timeMode: (mode: TimeMode) => `[data-testid="time-mode-${mode.toLowerCase()}"]`,
  /** All valid time mode values for iteration */
  allModes: TIME_MODES,
  /** Convenience selectors for common modes */
  auto: '[data-testid="time-mode-auto"]',
  am: '[data-testid="time-mode-am"]',
  pm: '[data-testid="time-mode-pm"]',
} as const;

/**
 * Migration Checklist for Playwright Tests
 *
 * | Test File           | Old Selector                     | New Selector                          |
 * |---------------------|----------------------------------|---------------------------------------|
 * | board.spec.js       | .grid-cell.header.horse-name     | selectors.horseHeader(id)             |
 * | board.spec.js       | .grid-cell.value                 | selectors.cell(horseId, feedId)       |
 * | board.spec.js       | .grid-cell.feed-name             | selectors.feedName(id)                |
 * | board.spec.js       | .grid-cell.note                  | selectors.note(id)                    |
 * | controller.spec.js  | .grid-cell.value (keypad)        | selectors.feedPad + preset/stepper    |
 * | controller.spec.js  | .mode-btn[data-mode="..."]       | timeModeSelectors.timeMode(mode)      |
 * | controller.spec.js  | unit-btn-scoop                   | unitSelectors.unitBtn('scoop')        |
 * | workflows.spec.js   | .grid-cell.feed-name             | selectors.feedName(id)                |
 * | workflows.spec.js   | .grid-cell.note                  | selectors.note(id)                    |
 */
