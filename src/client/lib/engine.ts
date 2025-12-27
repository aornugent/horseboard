import { signal, computed, batch, Signal, ReadonlySignal } from '@preact/signals';
import {
  DEFAULT_TIME_MODE,
  type TimeMode,
  type EffectiveTimeMode,
  type Board,
  type Unit,
} from '@shared/resources';
import { getEffectiveTimeMode } from '@shared/time-mode';

export type UpdateSource = 'api' | 'sse' | 'local';

interface Timestamped {
  updated_at: string;
  created_at: string;
}

type KeyFn<T> = (item: T) => string;

function shouldReplace<T extends Timestamped>(
  existing: T | undefined | null,
  incoming: T,
  source: UpdateSource
): boolean {
  if (source === 'sse') return true;
  if (!existing) return true;
  const existingTime = new Date(existing.updated_at).getTime();
  const incomingTime = new Date(incoming.updated_at).getTime();
  return incomingTime >= existingTime;
}

export interface CollectionStore<T extends Timestamped> {
  items: ReadonlySignal<T[]>;
  byId: ReadonlySignal<Map<string, T>>;
  version: Signal<number>;

  set: (items: T[], source?: UpdateSource) => void;
  add: (item: T, source?: UpdateSource) => void;
  update: (id: string, updates: Partial<T>, source?: UpdateSource) => void;
  upsert: (item: T, source?: UpdateSource) => void;
  remove: (id: string, source?: UpdateSource) => void;
  get: (id: string) => T | undefined;
  reconcile: (incomingItems: T[], source: UpdateSource) => void;
}

function createCollectionStore<T extends Timestamped>(keyFn: KeyFn<T>): CollectionStore<T> {
  const internalMap = new Map<string, T>();
  const version = signal(0);

  const items = computed(() => {
    version.value;
    return Array.from(internalMap.values());
  });

  const byId = computed(() => {
    version.value;
    return new Map(internalMap);
  });

  return {
    items,
    byId,
    version,

    set(newItems: T[], source: UpdateSource = 'api') {
      batch(() => {
        if (source === 'sse') {
          internalMap.clear();
          for (const item of newItems) {
            internalMap.set(keyFn(item), item);
          }
        } else {
          this.reconcile(newItems, source);
          return;
        }
        version.value++;
      });
    },

    add(item: T, source: UpdateSource = 'api') {
      const id = keyFn(item);
      const existing = internalMap.get(id);

      if (shouldReplace(existing, item, source)) {
        internalMap.set(id, item);
        version.value++;
      }
    },

    update(id: string, updates: Partial<T>, source: UpdateSource = 'api') {
      const existing = internalMap.get(id);
      if (!existing) return;

      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      } as T;

      if (shouldReplace(existing, updated, source)) {
        internalMap.set(id, updated);
        version.value++;
      }
    },

    upsert(item: T, source: UpdateSource = 'api') {
      const id = keyFn(item);
      const existing = internalMap.get(id);

      if (shouldReplace(existing, item, source)) {
        internalMap.set(id, item);
        version.value++;
      }
    },

    remove(id: string, _source: UpdateSource = 'api') {
      if (internalMap.delete(id)) {
        version.value++;
      }
    },

    get(id: string): T | undefined {
      return internalMap.get(id);
    },

    reconcile(incomingItems: T[], source: UpdateSource) {
      batch(() => {
        let changed = false;
        const incomingIds = new Set<string>();

        for (const item of incomingItems) {
          const id = keyFn(item);
          incomingIds.add(id);

          const existing = internalMap.get(id);
          if (shouldReplace(existing, item, source)) {
            internalMap.set(id, item);
            changed = true;
          }
        }

        if (source === 'sse') {
          for (const id of internalMap.keys()) {
            if (!incomingIds.has(id)) {
              internalMap.delete(id);
              changed = true;
            }
          }
        }

        if (changed) {
          version.value++;
        }
      });
    },
  };
}

export interface ResourceStore<T extends { id: string } & Timestamped>
  extends CollectionStore<T> {}

export function createResourceStore<T extends { id: string } & Timestamped>(): CollectionStore<T> {
  return createCollectionStore<T>((item) => item.id);
}

interface Horse {
  id: string;
  board_id: string;
  name: string;
  note: string | null;
  note_expiry: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface HorseStore extends CollectionStore<Horse> {
  searchQuery: Signal<string>;
  filtered: ReadonlySignal<Horse[]>;
  active: ReadonlySignal<Horse[]>;
}

export function createHorseStore(): HorseStore {
  const base = createCollectionStore<Horse>((h) => h.id);
  const searchQuery = signal('');

  const filtered = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) return base.items.value;
    return base.items.value.filter((h) => h.name.toLowerCase().includes(query));
  });

  const active = computed(() => {
    return base.items.value.filter((h) => !h.archived);
  });

  return {
    ...base,
    searchQuery,
    filtered,
    active,
  };
}

interface Feed {
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

export interface FeedStore extends CollectionStore<Feed> {
  byRank: ReadonlySignal<Feed[]>;
}

export function createFeedStore(): FeedStore {
  const base = createCollectionStore<Feed>((f) => f.id);

  const byRank = computed(() => {
    return [...base.items.value].sort((a, b) => b.rank - a.rank);
  });

  return {
    ...base,
    byRank,
  };
}

interface DietEntry {
  horse_id: string;
  feed_id: string;
  am_amount: number | null;
  pm_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface DietStore {
  items: ReadonlySignal<DietEntry[]>;
  byKey: ReadonlySignal<Map<string, DietEntry>>;
  byHorse: ReadonlySignal<Map<string, DietEntry[]>>;
  byFeed: ReadonlySignal<Map<string, DietEntry[]>>;
  version: Signal<number>;

  set: (entries: DietEntry[], source?: UpdateSource) => void;
  upsert: (entry: DietEntry, source?: UpdateSource) => void;
  updateAmount: (
    horse_id: string,
    feed_id: string,
    field: 'am_amount' | 'pm_amount',
    value: number | null,
    source?: UpdateSource
  ) => void;
  remove: (horse_id: string, feed_id: string, source?: UpdateSource) => void;
  get: (horse_id: string, feed_id: string) => DietEntry | undefined;
  countActiveFeeds: (horse_id: string) => number;
  reconcile: (entries: DietEntry[], source: UpdateSource) => void;
}

export function createDietStore(): DietStore {
  const getKey = (horse_id: string, feed_id: string) => `${horse_id}:${feed_id}`;
  const getEntryKey = (entry: DietEntry) => getKey(entry.horse_id, entry.feed_id);

  const base = createCollectionStore<DietEntry>(getEntryKey);

  const byHorse = computed(() => {
    base.version.value;
    const map = new Map<string, DietEntry[]>();
    for (const entry of base.items.value) {
      const existing = map.get(entry.horse_id) ?? [];
      existing.push(entry);
      map.set(entry.horse_id, existing);
    }
    return map;
  });

  const byFeed = computed(() => {
    base.version.value;
    const map = new Map<string, DietEntry[]>();
    for (const entry of base.items.value) {
      const existing = map.get(entry.feed_id) ?? [];
      existing.push(entry);
      map.set(entry.feed_id, existing);
    }
    return map;
  });

  return {
    items: base.items,
    byKey: base.byId,
    byHorse,
    byFeed,
    version: base.version,

    set: base.set,
    upsert: base.upsert,
    reconcile: base.reconcile,

    updateAmount(
      horse_id: string,
      feed_id: string,
      field: 'am_amount' | 'pm_amount',
      value: number | null,
      source: UpdateSource = 'local'
    ) {
      const key = getKey(horse_id, feed_id);
      const existing = base.get(key);
      const now = new Date().toISOString();

      if (existing) {
        const updated: DietEntry = {
          ...existing,
          [field]: value,
          updated_at: now,
        };
        if (shouldReplace(existing, updated, source)) {
          base.upsert(updated, source);
        }
      } else {
        const newEntry: DietEntry = {
          horse_id,
          feed_id,
          am_amount: field === 'am_amount' ? value : null,
          pm_amount: field === 'pm_amount' ? value : null,
          created_at: now,
          updated_at: now,
        };
        base.upsert(newEntry, source);
      }
    },

    remove(horse_id: string, feed_id: string, source?: UpdateSource) {
      base.remove(getKey(horse_id, feed_id), source);
    },

    get(horse_id: string, feed_id: string): DietEntry | undefined {
      return base.get(getKey(horse_id, feed_id));
    },

    countActiveFeeds(horse_id: string): number {
      const entries = byHorse.value.get(horse_id) ?? [];
      return entries.filter(
        (e) =>
          (e.am_amount !== null && e.am_amount !== 0) ||
          (e.pm_amount !== null && e.pm_amount !== 0)
      ).length;
    },
  };
}

export interface BoardStore {
  board: Signal<Board | null>;
  configured_mode: ReadonlySignal<TimeMode>;
  timezone: ReadonlySignal<string>;
  override_until: ReadonlySignal<string | null>;
  zoom_level: ReadonlySignal<number>;
  current_page: ReadonlySignal<number>;
  effective_time_mode: ReadonlySignal<EffectiveTimeMode>;

  set: (board: Board, source?: UpdateSource) => void;
  update: (updates: Partial<Board>, source?: UpdateSource) => void;
  updateTimeMode: (mode: TimeMode, override_until_date?: string | null) => void;
  setZoomLevel: (level: number) => void;
  setCurrentPage: (page: number) => void;
}

export function createBoardStore(): BoardStore {
  const board = signal<Board | null>(null);

  const configured_mode = computed<TimeMode>(() => board.value?.time_mode ?? DEFAULT_TIME_MODE);
  const timezone = computed(() => board.value?.timezone ?? 'UTC');
  const override_until = computed(() => board.value?.override_until ?? null);
  const zoom_level = computed(() => board.value?.zoom_level ?? 2);
  const current_page = computed(() => board.value?.current_page ?? 0);

  const effective_time_mode = computed<EffectiveTimeMode>(() => {
    return getEffectiveTimeMode(configured_mode.value, override_until.value, timezone.value);
  });

  return {
    board,
    configured_mode,
    timezone,
    override_until,
    zoom_level,
    current_page,
    effective_time_mode,

    set(newBoard: Board, source: UpdateSource = 'api') {
      if (shouldReplace(board.value, newBoard, source)) {
        board.value = newBoard;
      }
    },

    update(updates: Partial<Board>, source: UpdateSource = 'api') {
      if (!board.value) return;

      const updated: Board = {
        ...board.value,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (shouldReplace(board.value, updated, source)) {
        board.value = updated;
      }
    },

    updateTimeMode(mode: TimeMode, override_until_date?: string | null) {
      if (board.value) {
        board.value = {
          ...board.value,
          time_mode: mode,
          override_until: override_until_date ?? null,
          updated_at: new Date().toISOString(),
        };
      }
    },

    setZoomLevel(level: number) {
      if (board.value) {
        board.value = {
          ...board.value,
          zoom_level: level,
          updated_at: new Date().toISOString(),
        };
      }
    },

    setCurrentPage(page: number) {
      if (board.value) {
        board.value = {
          ...board.value,
          current_page: page,
          updated_at: new Date().toISOString(),
        };
      }
    },
  };
}
