import { signal, computed } from '@preact/signals';
import type { DietEntry } from '@shared/types';

// Diet entries signal
export const dietEntries = signal<DietEntry[]>([]);

// Derived: diet entry lookup by composite key (horseId:feedId)
export const dietByKey = computed(() => {
  const map = new Map<string, DietEntry>();
  for (const entry of dietEntries.value) {
    map.set(`${entry.horseId}:${entry.feedId}`, entry);
  }
  return map;
});

// Derived: get all entries for a specific horse
export const dietByHorse = computed(() => {
  const map = new Map<string, DietEntry[]>();
  for (const entry of dietEntries.value) {
    const existing = map.get(entry.horseId) ?? [];
    existing.push(entry);
    map.set(entry.horseId, existing);
  }
  return map;
});

// Derived: get all entries for a specific feed
export const dietByFeed = computed(() => {
  const map = new Map<string, DietEntry[]>();
  for (const entry of dietEntries.value) {
    const existing = map.get(entry.feedId) ?? [];
    existing.push(entry);
    map.set(entry.feedId, existing);
  }
  return map;
});

// Actions
export function setDietEntries(entries: DietEntry[]) {
  dietEntries.value = entries;
}

export function upsertDietEntry(entry: DietEntry) {
  const key = `${entry.horseId}:${entry.feedId}`;
  const existing = dietByKey.value.get(key);

  if (existing) {
    dietEntries.value = dietEntries.value.map(e =>
      e.horseId === entry.horseId && e.feedId === entry.feedId
        ? { ...entry, updatedAt: new Date().toISOString() }
        : e
    );
  } else {
    dietEntries.value = [...dietEntries.value, entry];
  }
}

export function updateDietAmount(
  horseId: string,
  feedId: string,
  field: 'amAmount' | 'pmAmount',
  value: number | null
) {
  const key = `${horseId}:${feedId}`;
  const existing = dietByKey.value.get(key);

  if (existing) {
    dietEntries.value = dietEntries.value.map(e =>
      e.horseId === horseId && e.feedId === feedId
        ? { ...e, [field]: value, updatedAt: new Date().toISOString() }
        : e
    );
  } else {
    // Create new entry if it doesn't exist
    const now = new Date().toISOString();
    const newEntry: DietEntry = {
      horseId,
      feedId,
      amAmount: field === 'amAmount' ? value : null,
      pmAmount: field === 'pmAmount' ? value : null,
      createdAt: now,
      updatedAt: now,
    };
    dietEntries.value = [...dietEntries.value, newEntry];
  }
}

export function removeDietEntry(horseId: string, feedId: string) {
  dietEntries.value = dietEntries.value.filter(
    e => !(e.horseId === horseId && e.feedId === feedId)
  );
}

export function getDietEntry(horseId: string, feedId: string): DietEntry | undefined {
  return dietByKey.value.get(`${horseId}:${feedId}`);
}

// Count active feeds for a horse (feeds with non-null, non-zero amounts)
export function countActiveFeeds(horseId: string): number {
  const entries = dietByHorse.value.get(horseId) ?? [];
  return entries.filter(e =>
    (e.amAmount !== null && e.amAmount !== 0) ||
    (e.pmAmount !== null && e.pmAmount !== 0)
  ).length;
}
