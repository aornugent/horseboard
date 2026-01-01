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
  createBoardStore,
  type UpdateSource,
} from '../lib/engine';
export * from './auth';

export type { UpdateSource };

const boardStore = createBoardStore();

export const board = boardStore.board;
export const configuredMode = boardStore.configured_mode;
export const timezone = boardStore.timezone;
export const overrideUntil = boardStore.override_until;
export const zoomLevel = boardStore.zoom_level;
export const currentPage = boardStore.current_page;
export const effectiveTimeMode = boardStore.effective_time_mode;

import { signal } from '@preact/signals';
export const ownership = signal<{
  is_claimed: boolean;
  is_owner: boolean;
  permission: 'none' | 'view' | 'edit' | 'admin';
}>({
  is_claimed: true, // Default to true (safe) until loaded
  is_owner: false,
  permission: 'view',
});

export const setOwnership = (val: typeof ownership.value) => {
  ownership.value = val;
};

export const setBoard = (b: Parameters<typeof boardStore.set>[0], source?: UpdateSource) =>
  boardStore.set(b, source);
export const updateBoard = boardStore.update;
export const updateTimeMode = boardStore.updateTimeMode;
export const setZoomLevel = boardStore.setZoomLevel;
export const setCurrentPage = boardStore.setCurrentPage;

const horseStore = createHorseStore();

export const horses = horseStore.items;
export const horsesById = horseStore.byId;
export const searchQuery = horseStore.searchQuery;
export const filteredHorses = horseStore.filtered;
export const activeHorses = horseStore.active;

export const setHorses = (items: Parameters<typeof horseStore.set>[0], source?: UpdateSource) =>
  horseStore.set(items, source);
export const addHorse = (item: Parameters<typeof horseStore.add>[0], source?: UpdateSource) =>
  horseStore.add(item, source);
export const updateHorse = (
  id: string,
  updates: Parameters<typeof horseStore.update>[1],
  source?: UpdateSource
) => horseStore.update(id, updates, source);
export const upsertHorse = (item: Parameters<typeof horseStore.upsert>[0], source?: UpdateSource) =>
  horseStore.upsert(item, source);
export const removeHorse = (id: string, source?: UpdateSource) => horseStore.remove(id, source);
export const getHorse = horseStore.get;
export const reconcileHorses = horseStore.reconcile;

const feedStore = createFeedStore();

export const feeds = feedStore.items;
export const feedsById = feedStore.byId;
export const feedsByRank = feedStore.byRank;

export const setFeeds = (items: Parameters<typeof feedStore.set>[0], source?: UpdateSource) =>
  feedStore.set(items, source);
export const addFeed = (item: Parameters<typeof feedStore.add>[0], source?: UpdateSource) =>
  feedStore.add(item, source);
export const updateFeed = (
  id: string,
  updates: Parameters<typeof feedStore.update>[1],
  source?: UpdateSource
) => feedStore.update(id, updates, source);
export const upsertFeed = (item: Parameters<typeof feedStore.upsert>[0], source?: UpdateSource) =>
  feedStore.upsert(item, source);
export const removeFeed = (id: string, source?: UpdateSource) => feedStore.remove(id, source);
export const getFeed = feedStore.get;
export const reconcileFeeds = feedStore.reconcile;

const dietStore = createDietStore();

export const dietEntries = dietStore.items;
export const dietByKey = dietStore.byKey;
export const dietByHorse = dietStore.byHorse;
export const dietByFeed = dietStore.byFeed;

export const setDietEntries = (
  items: Parameters<typeof dietStore.set>[0],
  source?: UpdateSource
) => dietStore.set(items, source);
export const upsertDietEntry = (
  entry: Parameters<typeof dietStore.upsert>[0],
  source?: UpdateSource
) => dietStore.upsert(entry, source);
export const updateDietAmount = (
  horse_id: string,
  feed_id: string,
  field: 'am_amount' | 'pm_amount',
  value: number | null,
  source?: UpdateSource
) => dietStore.updateAmount(horse_id, feed_id, field, value, source);
export const removeDietEntry = (horse_id: string, feed_id: string, source?: UpdateSource) =>
  dietStore.remove(horse_id, feed_id, source);
export const getDietEntry = dietStore.get;
export const countActiveFeeds = dietStore.countActiveFeeds;
export const reconcileDietEntries = dietStore.reconcile;
