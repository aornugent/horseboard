import { signal, computed, batch } from '@preact/signals';
import {
  DEFAULT_TIME_MODE,
  type TimeMode,
  type EffectiveTimeMode,
  type Board,
  type Horse,
  type Feed,
  type DietEntry,
  type BoardOrientation,
} from '@shared/resources';
import { getEffectiveTimeMode } from '@shared/time-mode';

// ============= Core State Signals =============
export const board = signal<Board | null>(null);
export const horses = signal<Horse[]>([]);
export const feeds = signal<Feed[]>([]);
export const diet = signal<DietEntry[]>([]);

// ============= SSE Bulk Update =============
export function setFromSSE(data: {
  board: Board;
  horses: Horse[];
  feeds: Feed[];
  diet_entries: DietEntry[];
}) {
  batch(() => {
    board.value = data.board;
    horses.value = data.horses;
    feeds.value = data.feeds;
    diet.value = data.diet_entries;
  });
}

// ============= Board Computed & Helpers =============
export const configured_mode = computed<TimeMode>(() => board.value?.time_mode ?? DEFAULT_TIME_MODE);
export const timezone = computed(() => board.value?.timezone ?? 'UTC');
export const override_until = computed(() => board.value?.override_until ?? null);
export const zoom_level = computed(() => board.value?.zoom_level ?? 2);
export const current_page = computed(() => board.value?.current_page ?? 0);
export const orientation = computed<BoardOrientation>(() => board.value?.orientation ?? 'horse-major');
export const pageSize = computed(() => {
  const level = zoom_level.value;
  return level === 1 ? 8 : level === 2 ? 6 : 4;
});
export const rowPageSize = computed(() => 10);
export const effective_time_mode = computed<EffectiveTimeMode>(() =>
  getEffectiveTimeMode(configured_mode.value, override_until.value, timezone.value)
);

export function updateBoard(updates: Partial<Board>) {
  if (!board.value) return;
  board.value = { ...board.value, ...updates, updated_at: new Date().toISOString() };
}

export function setZoomLevel(level: number) {
  updateBoard({ zoom_level: level });
}

export function setOrientation(newOrientation: BoardOrientation) {
  updateBoard({ orientation: newOrientation, current_page: 0 });
}

export function setCurrentPage(page: number) {
  updateBoard({ current_page: page });
}

// ============= Horse Helpers =============
export const searchQuery = signal('');
export const filteredHorses = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return horses.value;
  return horses.value.filter(h => h.name.toLowerCase().includes(query));
});
export const activeHorses = computed(() => horses.value.filter(h => !h.archived));

export function getHorse(id: string): Horse | undefined {
  return horses.value.find(h => h.id === id);
}

export function addHorse(horse: Horse) {
  if (horses.value.some(h => h.id === horse.id)) {
    updateHorse(horse.id, horse);
    return;
  }
  horses.value = [...horses.value, horse];
}

export function updateHorse(id: string, updates: Partial<Horse>) {
  horses.value = horses.value.map(h =>
    h.id === id ? { ...h, ...updates, updated_at: new Date().toISOString() } : h
  );
}

export function removeHorse(id: string) {
  horses.value = horses.value.filter(h => h.id !== id);
}

// ============= Feed Helpers =============
export function getFeed(id: string): Feed | undefined {
  return feeds.value.find(f => f.id === id);
}

export function addFeed(feed: Feed) {
  if (feeds.value.some(f => f.id === feed.id)) {
    updateFeed(feed.id, feed);
    return;
  }
  feeds.value = [...feeds.value, feed];
}

export function updateFeed(id: string, updates: Partial<Feed>) {
  feeds.value = feeds.value.map(f =>
    f.id === id ? { ...f, ...updates, updated_at: new Date().toISOString() } : f
  );
}

export function removeFeed(id: string) {
  feeds.value = feeds.value.filter(f => f.id !== id);
}

// ============= Diet Helpers =============
export function getDiet(horseId: string, feedId: string): DietEntry | undefined {
  return diet.value.find(e => e.horse_id === horseId && e.feed_id === feedId);
}

export function getDietByHorse(horseId: string): DietEntry[] {
  return diet.value.filter(e => e.horse_id === horseId);
}

export function countActiveFeeds(horseId: string): number {
  return getDietByHorse(horseId).filter(
    e => (e.am_amount !== null && e.am_amount !== 0) ||
      (e.pm_amount !== null && e.pm_amount !== 0) ||
      !!e.am_variant || !!e.pm_variant
  ).length;
}

export function updateDietAmount(
  horseId: string,
  feedId: string,
  field: 'am_amount' | 'pm_amount',
  value: number | null
) {
  const now = new Date().toISOString();
  const existing = getDiet(horseId, feedId);

  if (existing) {
    diet.value = diet.value.map(e =>
      e.horse_id === horseId && e.feed_id === feedId
        ? { ...e, [field]: value, updated_at: now }
        : e
    );
  } else {
    const newEntry: DietEntry = {
      horse_id: horseId,
      feed_id: feedId,
      am_amount: field === 'am_amount' ? value : null,
      pm_amount: field === 'pm_amount' ? value : null,
      am_variant: null,
      pm_variant: null,
      created_at: now,
      updated_at: now,
    };
    diet.value = [...diet.value, newEntry];
  }
}

/**
 * Atomically clear all diet values for a horse/feed pair.
 * Sets AM/PM amounts and variants to null in a single update.
 */
export function clearDietEntry(horseId: string, feedId: string) {
  const now = new Date().toISOString();
  diet.value = diet.value.map(e =>
    e.horse_id === horseId && e.feed_id === feedId
      ? { ...e, am_amount: null, pm_amount: null, am_variant: null, pm_variant: null, updated_at: now }
      : e
  );
}

// ============= Token Reactivity =============
export * from './token';

// ============= Permission =============
export * from './permission';

// Re-export auth module
export * from './auth';
