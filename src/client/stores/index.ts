/**
 * Unified Store Module
 *
 * Creates all stores using the engine factories and re-exports
 * the same API that the UI components expect.
 */
import {
  createHorseStore,
  createFeedStore,
  createDietStore,
  createDisplayStore,
} from '../lib/engine';

// =============================================================================
// DISPLAY STORE
// =============================================================================

const displayStore = createDisplayStore();

// Re-export display store properties
export const display = displayStore.display;
export const configuredMode = displayStore.configuredMode;
export const timezone = displayStore.timezone;
export const overrideUntil = displayStore.overrideUntil;
export const zoomLevel = displayStore.zoomLevel;
export const currentPage = displayStore.currentPage;
export const effectiveTimeMode = displayStore.effectiveTimeMode;

// Re-export display store methods
export const setDisplay = displayStore.set;
export const updateTimeMode = displayStore.updateTimeMode;
export const setZoomLevel = displayStore.setZoomLevel;
export const setCurrentPage = displayStore.setCurrentPage;

// =============================================================================
// HORSES STORE
// =============================================================================

const horseStore = createHorseStore();

// Re-export horse store properties
export const horses = horseStore.items;
export const horsesById = horseStore.byId;
export const searchQuery = horseStore.searchQuery;
export const filteredHorses = horseStore.filtered;
export const activeHorses = horseStore.active;

// Re-export horse store methods
export const setHorses = horseStore.set;
export const addHorse = horseStore.add;
export const updateHorse = horseStore.update;
export const removeHorse = horseStore.remove;
export const getHorse = horseStore.get;

// =============================================================================
// FEEDS STORE
// =============================================================================

const feedStore = createFeedStore();

// Re-export feed store properties
export const feeds = feedStore.items;
export const feedsById = feedStore.byId;
export const feedsByRank = feedStore.byRank;

// Re-export feed store methods
export const setFeeds = feedStore.set;
export const addFeed = feedStore.add;
export const updateFeed = feedStore.update;
export const removeFeed = feedStore.remove;
export const getFeed = feedStore.get;

// =============================================================================
// DIET STORE
// =============================================================================

const dietStore = createDietStore();

// Re-export diet store properties
export const dietEntries = dietStore.items;
export const dietByKey = dietStore.byKey;
export const dietByHorse = dietStore.byHorse;
export const dietByFeed = dietStore.byFeed;

// Re-export diet store methods
export const setDietEntries = dietStore.set;
export const upsertDietEntry = dietStore.upsert;
export const updateDietAmount = dietStore.updateAmount;
export const removeDietEntry = dietStore.remove;
export const getDietEntry = dietStore.get;
export const countActiveFeeds = dietStore.countActiveFeeds;
