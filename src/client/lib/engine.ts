import { signal, computed, Signal, ReadonlySignal } from '@preact/signals';
import type { z } from 'zod';
import { RESOURCES, type ResourceName } from '@shared/resources';

type InferSchema<T> = T extends z.ZodType<infer U> ? U : never;

/**
 * Generic resource store interface
 */
export interface ResourceStore<T> {
  items: Signal<T[]>;
  byId: ReadonlySignal<Map<string, T>>;
  set: (items: T[]) => void;
  add: (item: T) => void;
  update: (id: string, updates: Partial<T>) => void;
  remove: (id: string) => void;
  get: (id: string) => T | undefined;
}

/**
 * Create a resource store from configuration
 */
export function createResourceStore<T extends { id: string }>(
  resourceName: ResourceName
): ResourceStore<T> {
  const config = RESOURCES[resourceName];
  const primaryKey = config.primaryKey;
  const isComposite = Array.isArray(primaryKey);

  const items = signal<T[]>([]);

  // Create lookup map by ID
  const byId = computed(() => {
    const map = new Map<string, T>();
    for (const item of items.value) {
      if (isComposite) {
        // For composite keys (diet), use combined key
        const keys = primaryKey as string[];
        const key = keys.map((k) => (item as Record<string, unknown>)[k]).join(':');
        map.set(key, item);
      } else {
        map.set((item as Record<string, string>)[primaryKey as string], item);
      }
    }
    return map;
  });

  return {
    items,
    byId,

    set(newItems: T[]) {
      items.value = newItems;
    },

    add(item: T) {
      items.value = [...items.value, item];
    },

    update(id: string, updates: Partial<T>) {
      items.value = items.value.map((item) => {
        const itemId = isComposite
          ? (primaryKey as string[])
              .map((k) => (item as Record<string, unknown>)[k])
              .join(':')
          : (item as Record<string, string>)[primaryKey as string];

        if (itemId === id) {
          return { ...item, ...updates, updatedAt: new Date().toISOString() };
        }
        return item;
      });
    },

    remove(id: string) {
      items.value = items.value.filter((item) => {
        const itemId = isComposite
          ? (primaryKey as string[])
              .map((k) => (item as Record<string, unknown>)[k])
              .join(':')
          : (item as Record<string, string>)[primaryKey as string];
        return itemId !== id;
      });
    },

    get(id: string): T | undefined {
      return byId.value.get(id);
    },
  };
}

/**
 * Diet entry store with specialized methods
 */
export interface DietStore {
  items: Signal<DietEntry[]>;
  byKey: ReadonlySignal<Map<string, DietEntry>>;
  byHorse: ReadonlySignal<Map<string, DietEntry[]>>;
  byFeed: ReadonlySignal<Map<string, DietEntry[]>>;
  set: (entries: DietEntry[]) => void;
  upsert: (entry: DietEntry) => void;
  updateAmount: (
    horseId: string,
    feedId: string,
    field: 'amAmount' | 'pmAmount',
    value: number | null
  ) => void;
  remove: (horseId: string, feedId: string) => void;
  get: (horseId: string, feedId: string) => DietEntry | undefined;
  countActiveFeeds: (horseId: string) => number;
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
 * Create specialized diet store
 */
export function createDietStore(): DietStore {
  const items = signal<DietEntry[]>([]);

  const byKey = computed(() => {
    const map = new Map<string, DietEntry>();
    for (const entry of items.value) {
      map.set(`${entry.horseId}:${entry.feedId}`, entry);
    }
    return map;
  });

  const byHorse = computed(() => {
    const map = new Map<string, DietEntry[]>();
    for (const entry of items.value) {
      const existing = map.get(entry.horseId) ?? [];
      existing.push(entry);
      map.set(entry.horseId, existing);
    }
    return map;
  });

  const byFeed = computed(() => {
    const map = new Map<string, DietEntry[]>();
    for (const entry of items.value) {
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

    set(entries: DietEntry[]) {
      items.value = entries;
    },

    upsert(entry: DietEntry) {
      const key = `${entry.horseId}:${entry.feedId}`;
      const existing = byKey.value.get(key);

      if (existing) {
        items.value = items.value.map((e) =>
          e.horseId === entry.horseId && e.feedId === entry.feedId
            ? { ...entry, updatedAt: new Date().toISOString() }
            : e
        );
      } else {
        items.value = [...items.value, entry];
      }
    },

    updateAmount(
      horseId: string,
      feedId: string,
      field: 'amAmount' | 'pmAmount',
      value: number | null
    ) {
      const key = `${horseId}:${feedId}`;
      const existing = byKey.value.get(key);

      if (existing) {
        items.value = items.value.map((e) =>
          e.horseId === horseId && e.feedId === feedId
            ? { ...e, [field]: value, updatedAt: new Date().toISOString() }
            : e
        );
      } else {
        const now = new Date().toISOString();
        const newEntry: DietEntry = {
          horseId,
          feedId,
          amAmount: field === 'amAmount' ? value : null,
          pmAmount: field === 'pmAmount' ? value : null,
          createdAt: now,
          updatedAt: now,
        };
        items.value = [...items.value, newEntry];
      }
    },

    remove(horseId: string, feedId: string) {
      items.value = items.value.filter(
        (e) => !(e.horseId === horseId && e.feedId === feedId)
      );
    },

    get(horseId: string, feedId: string): DietEntry | undefined {
      return byKey.value.get(`${horseId}:${feedId}`);
    },

    countActiveFeeds(horseId: string): number {
      const entries = byHorse.value.get(horseId) ?? [];
      return entries.filter(
        (e) =>
          (e.amAmount !== null && e.amAmount !== 0) ||
          (e.pmAmount !== null && e.pmAmount !== 0)
      ).length;
    },
  };
}

/**
 * Display store with specialized methods
 */
export interface DisplayStore {
  display: Signal<Display | null>;
  configuredMode: ReadonlySignal<TimeMode>;
  timezone: ReadonlySignal<string>;
  overrideUntil: ReadonlySignal<string | null>;
  zoomLevel: ReadonlySignal<number>;
  currentPage: ReadonlySignal<number>;
  effectiveTimeMode: ReadonlySignal<'AM' | 'PM'>;
  set: (display: Display) => void;
  updateTimeMode: (mode: TimeMode, overrideUntilDate?: string | null) => void;
  setZoomLevel: (level: 1 | 2 | 3) => void;
  setCurrentPage: (page: number) => void;
}

type TimeMode = 'AUTO' | 'AM' | 'PM';

interface Display {
  id: string;
  pairCode: string;
  timezone: string;
  timeMode: TimeMode;
  overrideUntil: string | null;
  zoomLevel: 1 | 2 | 3;
  currentPage: number;
  createdAt: string;
  updatedAt: string;
}

// Import shared time mode logic
import { getEffectiveTimeMode } from '@shared/time-mode';

/**
 * Create specialized display store
 */
export function createDisplayStore(): DisplayStore {
  const display = signal<Display | null>(null);

  const configuredMode = computed<TimeMode>(() => display.value?.timeMode ?? 'AUTO');
  const timezone = computed(() => display.value?.timezone ?? 'UTC');
  const overrideUntil = computed(() => display.value?.overrideUntil ?? null);
  const zoomLevel = computed(() => display.value?.zoomLevel ?? 2);
  const currentPage = computed(() => display.value?.currentPage ?? 0);

  const effectiveTimeMode = computed<'AM' | 'PM'>(() => {
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

    set(newDisplay: Display) {
      display.value = newDisplay;
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

    setZoomLevel(level: 1 | 2 | 3) {
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

/**
 * Horse store with search and filtering
 */
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

/**
 * Feed store with ranking
 */
export interface FeedStore extends ResourceStore<Feed> {
  byRank: ReadonlySignal<Feed[]>;
}

interface Feed {
  id: string;
  displayId: string;
  name: string;
  unit: 'scoop' | 'ml' | 'sachet' | 'biscuit';
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
