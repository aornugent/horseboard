import { signal, computed } from '@preact/signals';
import type { DietEntry } from '@shared/types';

export const dietEntries = signal<DietEntry[]>([]);

const makeKey = (h: string, f: string) => `${h}:${f}`;

export const dietByKey = computed(() => new Map(dietEntries.value.map(e => [makeKey(e.horseId, e.feedId), e])));

export const dietByHorse = computed(() => {
  const map = new Map<string, DietEntry[]>();
  for (const e of dietEntries.value) (map.get(e.horseId) ?? map.set(e.horseId, []).get(e.horseId)!).push(e);
  return map;
});

export const dietByFeed = computed(() => {
  const map = new Map<string, DietEntry[]>();
  for (const e of dietEntries.value) (map.get(e.feedId) ?? map.set(e.feedId, []).get(e.feedId)!).push(e);
  return map;
});

export const setDietEntries = (list: DietEntry[]) => { dietEntries.value = list; };
export const getDietEntry = (h: string, f: string) => dietByKey.value.get(makeKey(h, f));
export const removeDietEntry = (h: string, f: string) => {
  dietEntries.value = dietEntries.value.filter(e => !(e.horseId === h && e.feedId === f));
};

export function upsertDietEntry(entry: DietEntry) {
  const exists = dietByKey.value.has(makeKey(entry.horseId, entry.feedId));
  if (exists) {
    dietEntries.value = dietEntries.value.map(e =>
      e.horseId === entry.horseId && e.feedId === entry.feedId
        ? { ...entry, updatedAt: new Date().toISOString() } : e
    );
  } else {
    dietEntries.value = [...dietEntries.value, entry];
  }
}

export function updateDietAmount(horseId: string, feedId: string, field: 'amAmount' | 'pmAmount', value: number | null) {
  const existing = getDietEntry(horseId, feedId);
  if (existing) {
    dietEntries.value = dietEntries.value.map(e =>
      e.horseId === horseId && e.feedId === feedId
        ? { ...e, [field]: value, updatedAt: new Date().toISOString() } : e
    );
  } else {
    const now = new Date().toISOString();
    dietEntries.value = [...dietEntries.value, {
      horseId, feedId, amAmount: field === 'amAmount' ? value : null,
      pmAmount: field === 'pmAmount' ? value : null, createdAt: now, updatedAt: now,
    }];
  }
}

export function countActiveFeeds(horseId: string): number {
  const entries = dietByHorse.value.get(horseId) ?? [];
  return entries.filter(e => (e.amAmount !== null && e.amAmount !== 0) || (e.pmAmount !== null && e.pmAmount !== 0)).length;
}
