import { signal, computed, batch, Signal, ReadonlySignal } from '@preact/signals';
import {
  RESOURCES,
  DEFAULT_TIME_MODE,
  type ResourceName,
  type TimeMode,
  type EffectiveTimeMode,
  type Board,
  type Unit,
} from '@shared/resources';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Update source for reconciliation - SSE events take precedence
 */
export type UpdateSource = 'api' | 'sse' | 'local';

/**
 * Item with timestamp for reconciliation
 */
interface Timestamped {
  updated_at: string;
  created_at: string;
}

/**
 * Generic resource store interface with efficient Map-based storage
 */
export interface ResourceStore<T extends { id: string } & Timestamped> {
  /** Signal containing the items array (derived from internal Map) */
  items: ReadonlySignal<T[]>;
  /** Lookup map by ID */
  byId: ReadonlySignal<Map<string, T>>;
  /** Version counter to trigger reactivity */
  version: Signal<number>;

  // Mutation methods
  set: (items: T[], source?: UpdateSource) => void;
  add: (item: T, source?: UpdateSource) => void;
  update: (id: string, updates: Partial<T>, source?: UpdateSource) => void;
  upsert: (item: T, source?: UpdateSource) => void;
  remove: (id: string, source?: UpdateSource) => void;
  get: (id: string) => T | undefined;

  // Reconciliation
  reconcile: (incomingItems: T[], source: UpdateSource) => void;
}

// =============================================================================
// EFFICIENT MAP-BASED STORE
// =============================================================================

/**
 * Create a resource store using Map for O(1) lookups and efficient updates
 *
 * Key improvements over array-based approach:
 * 1. Updates don't iterate entire collection
 * 2. Version signal allows batched reactivity
 * 3. Reconciliation handles conflicts between API and SSE
 */
export function createResourceStore<T extends { id: string } & Timestamped>(
  resourceName: ResourceName
): ResourceStore<T> {
  const config = RESOURCES[resourceName];
  const primaryKey = config.primaryKey;
  const isComposite = Array.isArray(primaryKey);

  // Internal Map storage - not directly reactive
  const internalMap = new Map<string, T>();

  // Version counter triggers reactivity when bumped
  const version = signal(0);

  // Helper to get ID from item
  const getItemId = (item: T): string => {
    if (isComposite) {
      const keys = primaryKey as string[];
      return keys.map((k) => (item as Record<string, unknown>)[k]).join(':');
    }
    return String((item as Record<string, unknown>)[primaryKey as string]);
  };

  // Derived signals that react to version changes
  const items = computed(() => {
    // Access version to establish dependency
    version.value;
    return Array.from(internalMap.values());
  });

  const byId = computed(() => {
    version.value;
    return new Map(internalMap);
  });

  /**
   * Determine if incoming item should replace existing
   * SSE events always win; otherwise compare timestamps
   */
  const shouldReplace = (
    existing: T | undefined,
    incoming: T,
    source: UpdateSource
  ): boolean => {
    // SSE is authoritative - always accept
    if (source === 'sse') return true;

    // No existing item - always accept
    if (!existing) return true;

    // Compare timestamps - newer wins
    const existingTime = new Date(existing.updated_at).getTime();
    const incomingTime = new Date(incoming.updated_at).getTime();
    return incomingTime >= existingTime;
  };

  return {
    items,
    byId,
    version,

    set(newItems: T[], source: UpdateSource = 'api') {
      batch(() => {
        if (source === 'sse') {
          // SSE full replacement - clear and repopulate
          internalMap.clear();
          for (const item of newItems) {
            internalMap.set(getItemId(item), item);
          }
        } else {
          // API/local - reconcile with existing
          this.reconcile(newItems, source);
          return; // reconcile bumps version
        }
        version.value++;
      });
    },

    add(item: T, source: UpdateSource = 'api') {
      const id = getItemId(item);
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
      const id = getItemId(item);
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

    /**
     * Reconcile incoming items with existing state
     * Handles conflicts by comparing timestamps
     */
    reconcile(incomingItems: T[], source: UpdateSource) {
      batch(() => {
        let changed = false;

        // Track which IDs are in incoming set
        const incomingIds = new Set<string>();

        for (const item of incomingItems) {
          const id = getItemId(item);
          incomingIds.add(id);

          const existing = internalMap.get(id);
          if (shouldReplace(existing, item, source)) {
            internalMap.set(id, item);
            changed = true;
          }
        }

        // For SSE source, remove items not in incoming set
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

// =============================================================================
// DIET STORE
// =============================================================================

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

interface DietEntry {
  horse_id: string;
  feed_id: string;
  am_amount: number | null;
  pm_amount: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create specialized diet store with efficient composite key handling
 */
export function createDietStore(): DietStore {
  // Internal Map storage with composite key
  const internalMap = new Map<string, DietEntry>();
  const version = signal(0);

  const getKey = (horse_id: string, feed_id: string) => `${horse_id}:${feed_id}`;
  const getEntryKey = (entry: DietEntry) => getKey(entry.horse_id, entry.feed_id);

  const shouldReplace = (
    existing: DietEntry | undefined,
    incoming: DietEntry,
    source: UpdateSource
  ): boolean => {
    if (source === 'sse') return true;
    if (!existing) return true;
    const existingTime = new Date(existing.updated_at).getTime();
    const incomingTime = new Date(incoming.updated_at).getTime();
    return incomingTime >= existingTime;
  };

  // Derived signals
  const items = computed(() => {
    version.value;
    return Array.from(internalMap.values());
  });

  const byKey = computed(() => {
    version.value;
    return new Map(internalMap);
  });

  const byHorse = computed(() => {
    version.value;
    const map = new Map<string, DietEntry[]>();
    for (const entry of internalMap.values()) {
      const existing = map.get(entry.horse_id) ?? [];
      existing.push(entry);
      map.set(entry.horse_id, existing);
    }
    return map;
  });

  const byFeed = computed(() => {
    version.value;
    const map = new Map<string, DietEntry[]>();
    for (const entry of internalMap.values()) {
      const existing = map.get(entry.feed_id) ?? [];
      existing.push(entry);
      map.set(entry.feed_id, existing);
    }
    return map;
  });

  return {
    items,
    byKey,
    byHorse,
    byFeed,
    version,

    set(entries: DietEntry[], source: UpdateSource = 'api') {
      batch(() => {
        if (source === 'sse') {
          internalMap.clear();
          for (const entry of entries) {
            internalMap.set(getEntryKey(entry), entry);
          }
        } else {
          this.reconcile(entries, source);
          return;
        }
        version.value++;
      });
    },

    upsert(entry: DietEntry, source: UpdateSource = 'api') {
      const key = getEntryKey(entry);
      const existing = internalMap.get(key);

      if (shouldReplace(existing, entry, source)) {
        internalMap.set(key, entry);
        version.value++;
      }
    },

    updateAmount(
      horse_id: string,
      feed_id: string,
      field: 'am_amount' | 'pm_amount',
      value: number | null,
      source: UpdateSource = 'local'
    ) {
      const key = getKey(horse_id, feed_id);
      const existing = internalMap.get(key);
      const now = new Date().toISOString();

      if (existing) {
        // Update existing entry
        const updated: DietEntry = {
          ...existing,
          [field]: value,
          updated_at: now,
        };
        if (shouldReplace(existing, updated, source)) {
          internalMap.set(key, updated);
          version.value++;
        }
      } else {
        // Create new entry
        const newEntry: DietEntry = {
          horse_id,
          feed_id,
          am_amount: field === 'am_amount' ? value : null,
          pm_amount: field === 'pm_amount' ? value : null,
          created_at: now,
          updated_at: now,
        };
        internalMap.set(key, newEntry);
        version.value++;
      }
    },

    remove(horse_id: string, feed_id: string, _source: UpdateSource = 'api') {
      const key = getKey(horse_id, feed_id);
      if (internalMap.delete(key)) {
        version.value++;
      }
    },

    get(horse_id: string, feed_id: string): DietEntry | undefined {
      return internalMap.get(getKey(horse_id, feed_id));
    },

    countActiveFeeds(horse_id: string): number {
      const entries = byHorse.value.get(horse_id) ?? [];
      return entries.filter(
        (e) =>
          (e.am_amount !== null && e.am_amount !== 0) ||
          (e.pm_amount !== null && e.pm_amount !== 0)
      ).length;
    },

    reconcile(entries: DietEntry[], source: UpdateSource) {
      batch(() => {
        let changed = false;
        const incomingKeys = new Set<string>();

        for (const entry of entries) {
          const key = getEntryKey(entry);
          incomingKeys.add(key);

          const existing = internalMap.get(key);
          if (shouldReplace(existing, entry, source)) {
            internalMap.set(key, entry);
            changed = true;
          }
        }

        if (source === 'sse') {
          for (const key of internalMap.keys()) {
            if (!incomingKeys.has(key)) {
              internalMap.delete(key);
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

// =============================================================================
// BOARD STORE
// =============================================================================

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

// Board type imported from @shared/resources

import { getEffectiveTimeMode } from '@shared/time-mode';

/**
 * Create specialized board store with reconciliation
 */
export function createBoardStore(): BoardStore {
  const board = signal<Board | null>(null);

  const shouldReplace = (
    existing: Board | null,
    incoming: Board,
    source: UpdateSource
  ): boolean => {
    if (source === 'sse') return true;
    if (!existing) return true;
    const existingTime = new Date(existing.updated_at).getTime();
    const incomingTime = new Date(incoming.updated_at).getTime();
    return incomingTime >= existingTime;
  };

  const configured_mode = computed<TimeMode>(() => board.value?.time_mode ?? DEFAULT_TIME_MODE);
  const timezone = computed(() => board.value?.timezone ?? 'UTC');
  const override_until = computed(() => board.value?.override_until ?? null);
  const zoom_level = computed(() => board.value?.zoom_level ?? 2);
  const current_page = computed(() => board.value?.current_page ?? 0);

  const effective_time_mode = computed<EffectiveTimeMode>(() => {
    return getEffectiveTimeMode(
      configured_mode.value,
      override_until.value,
      timezone.value
    );
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

// =============================================================================
// HORSE STORE
// =============================================================================

export interface HorseStore extends ResourceStore<Horse> {
  searchQuery: Signal<string>;
  filtered: ReadonlySignal<Horse[]>;
  active: ReadonlySignal<Horse[]>;
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

/**
 * Create specialized horse store with search
 */
export function createHorseStore(): HorseStore {
  const base = createResourceStore<Horse>('horses');
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

// =============================================================================
// FEED STORE
// =============================================================================

export interface FeedStore extends ResourceStore<Feed> {
  byRank: ReadonlySignal<Feed[]>;
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

/**
 * Create specialized feed store with ranking
 */
export function createFeedStore(): FeedStore {
  const base = createResourceStore<Feed>('feeds');

  const byRank = computed(() => {
    return [...base.items.value].sort((a, b) => b.rank - a.rank);
  });

  return {
    ...base,
    byRank,
  };
}
