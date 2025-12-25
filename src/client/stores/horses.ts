import { signal, computed } from '@preact/signals';
import type { Horse } from '@shared/types';

// Horses signal
export const horses = signal<Horse[]>([]);

// Search query for filtering horses
export const searchQuery = signal('');

// Derived: filtered horses based on search query
export const filteredHorses = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return horses.value;
  return horses.value.filter(h => h.name.toLowerCase().includes(query));
});

// Derived: horse lookup by ID
export const horsesById = computed(() => {
  const map = new Map<string, Horse>();
  for (const horse of horses.value) {
    map.set(horse.id, horse);
  }
  return map;
});

// Derived: active (non-archived) horses
export const activeHorses = computed(() => {
  return horses.value.filter(h => !h.archived);
});

// Actions
export function setHorses(newHorses: Horse[]) {
  horses.value = newHorses;
}

export function addHorse(horse: Horse) {
  horses.value = [...horses.value, horse];
}

export function updateHorse(id: string, updates: Partial<Horse>) {
  horses.value = horses.value.map(h =>
    h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
  );
}

export function removeHorse(id: string) {
  horses.value = horses.value.filter(h => h.id !== id);
}

export function getHorse(id: string): Horse | undefined {
  return horsesById.value.get(id);
}
