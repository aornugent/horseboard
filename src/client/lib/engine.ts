import { signal, computed, batch, Signal, ReadonlySignal } from '@preact/signals';
import {
  RESOURCES,
  DEFAULT_TIME_MODE,
  type ResourceName,
  type TimeMode,
  type EffectiveTimeMode,
  type Display,
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
  updatedAt: string;
  createdAt: string;
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
    const existingTime = new Date(existing.updatedAt).getTime();
    const incomingTime = new Date(incoming.updatedAt).getTime();
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
        updatedAt: new Date().toISOString(),
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
    horseId: string,
    feedId: string,
    field: 'amAmount' | 'pmAmount',
    value: number | null,
    source?: UpdateSource
  ) => void;
  remove: (horseId: string, feedId: string, source?: UpdateSource) => void;
  get: (horseId: string, feedId: string) => DietEntry | undefined;
  countActiveFeeds: (horseId: string) => number;
  reconcile: (entries: DietEntry[], source: UpdateSource) => void;
}

interface DietEntry {
  horseId: string;
  feedId: string;
  amAmount: number | null;
  pmAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create specialized diet store with efficient composite key handling
 */
export function createDietStore(): DietStore {
  // Internal Map storage with composite key
  const internalMap = new Map<string, DietEntry>();
  const version = signal(0);

  const getKey = (horseId: string, feedId: string) => `${horseId}:${feedId}`;
  const getEntryKey = (entry: DietEntry) => getKey(entry.horseId, entry.feedId);

  const shouldReplace = (
    existing: DietEntry | undefined,
    incoming: DietEntry,
    source: UpdateSource
  ): boolean => {
    if (source === 'sse') return true;
    if (!existing) return true;
    const existingTime = new Date(existing.updatedAt).getTime();
    const incomingTime = new Date(incoming.updatedAt).getTime();
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
      const existing = map.get(entry.horseId) ?? [];
      existing.push(entry);
      map.set(entry.horseId, existing);
    }
    return map;
  });

  const byFeed = computed(() => {
    version.value;
    const map = new Map<string, DietEntry[]>();
    for (const entry of internalMap.values()) {
      const existing = map.get(entry.feedId) ?? [];
      existing.push(entry);
      map.set(entry.feedId, existing);
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
      horseId: string,
      feedId: string,
      field: 'amAmount' | 'pmAmount',
      value: number | null,
      source: UpdateSource = 'local'
    ) {
      const key = getKey(horseId, feedId);
      const existing = internalMap.get(key);
      const now = new Date().toISOString();

      if (existing) {
        // Update existing entry
        const updated: DietEntry = {
          ...existing,
          [field]: value,
          updatedAt: now,
        };
        if (shouldReplace(existing, updated, source)) {
          internalMap.set(key, updated);
          version.value++;
        }
      } else {
        // Create new entry
        const newEntry: DietEntry = {
          horseId,
          feedId,
          amAmount: field === 'amAmount' ? value : null,
          pmAmount: field === 'pmAmount' ? value : null,
          createdAt: now,
          updatedAt: now,
        };
        internalMap.set(key, newEntry);
        version.value++;
      }
    },

    remove(horseId: string, feedId: string, _source: UpdateSource = 'api') {
      const key = getKey(horseId, feedId);
      if (internalMap.delete(key)) {
        version.value++;
      }
    },

    get(horseId: string, feedId: string): DietEntry | undefined {
      return internalMap.get(getKey(horseId, feedId));
    },

    countActiveFeeds(horseId: string): number {
      const entries = byHorse.value.get(horseId) ?? [];
      return entries.filter(
        (e) =>
          (e.amAmount !== null && e.amAmount !== 0) ||
          (e.pmAmount !== null && e.pmAmount !== 0)
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
// DISPLAY STORE
// =============================================================================

export interface DisplayStore {
  display: Signal<Display | null>;
  configuredMode: ReadonlySignal<TimeMode>;
  timezone: ReadonlySignal<string>;
  overrideUntil: ReadonlySignal<string | null>;
  zoomLevel: ReadonlySignal<number>;
  currentPage: ReadonlySignal<number>;
  effectiveTimeMode: ReadonlySignal<EffectiveTimeMode>;

  set: (display: Display, source?: UpdateSource) => void;
  update: (updates: Partial<Display>, source?: UpdateSource) => void;
  updateTimeMode: (mode: TimeMode, overrideUntilDate?: string | null) => void;
  setZoomLevel: (level: number) => void;
  setCurrentPage: (page: number) => void;
}

// Display type imported from @shared/resources

import { getEffectiveTimeMode } from '@shared/time-mode';

/**
 * Create specialized display store with reconciliation
 */
export function createDisplayStore(): DisplayStore {
  const display = signal<Display | null>(null);

  const shouldReplace = (
    existing: Display | null,
    incoming: Display,
    source: UpdateSource
  ): boolean => {
    if (source === 'sse') return true;
    if (!existing) return true;
    const existingTime = new Date(existing.updatedAt).getTime();
    const incomingTime = new Date(incoming.updatedAt).getTime();
    return incomingTime >= existingTime;
  };

  const configuredMode = computed<TimeMode>(() => display.value?.timeMode ?? DEFAULT_TIME_MODE);
  const timezone = computed(() => display.value?.timezone ?? 'UTC');
  const overrideUntil = computed(() => display.value?.overrideUntil ?? null);
  const zoomLevel = computed(() => display.value?.zoomLevel ?? 2);
  const currentPage = computed(() => display.value?.currentPage ?? 0);

  const effectiveTimeMode = computed<EffectiveTimeMode>(() => {
    return getEffectiveTimeMode(
      configuredMode.value,
      overrideUntil.value,
      timezone.value
    );
  });

  return {
    display,
    configuredMode,
    timezone,
    overrideUntil,
    zoomLevel,
    currentPage,
    effectiveTimeMode,

    set(newDisplay: Display, source: UpdateSource = 'api') {
      if (shouldReplace(display.value, newDisplay, source)) {
        display.value = newDisplay;
      }
    },

    update(updates: Partial<Display>, source: UpdateSource = 'api') {
      if (!display.value) return;

      const updated: Display = {
        ...display.value,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (shouldReplace(display.value, updated, source)) {
        display.value = updated;
      }
    },

    updateTimeMode(mode: TimeMode, overrideUntilDate?: string | null) {
      if (display.value) {
        display.value = {
          ...display.value,
          timeMode: mode,
          overrideUntil: overrideUntilDate ?? null,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    setZoomLevel(level: number) {
      if (display.value) {
        display.value = {
          ...display.value,
          zoomLevel: level,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    setCurrentPage(page: number) {
      if (display.value) {
        display.value = {
          ...display.value,
          currentPage: page,
          updatedAt: new Date().toISOString(),
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
  displayId: string;
  name: string;
  note: string | null;
  noteExpiry: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
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
  displayId: string;
  name: string;
  unit: Unit;
  rank: number;
  stockLevel: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
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
