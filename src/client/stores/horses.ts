import { signal, computed } from '@preact/signals';
import type { Horse } from '@shared/types';

export const horses = signal<Horse[]>([]);
export const searchQuery = signal('');

export const filteredHorses = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  return q ? horses.value.filter(h => h.name.toLowerCase().includes(q)) : horses.value;
});

export const horsesById = computed(() => new Map(horses.value.map(h => [h.id, h])));
export const activeHorses = computed(() => horses.value.filter(h => !h.archived));

export const setHorses = (list: Horse[]) => { horses.value = list; };
export const addHorse = (h: Horse) => { horses.value = [...horses.value, h]; };
export const removeHorse = (id: string) => { horses.value = horses.value.filter(h => h.id !== id); };
export const getHorse = (id: string) => horsesById.value.get(id);

export function updateHorse(id: string, updates: Partial<Horse>) {
  horses.value = horses.value.map(h =>
    h.id === id ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
  );
}
