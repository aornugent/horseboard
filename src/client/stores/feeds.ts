import { signal, computed } from '@preact/signals';
import type { Feed } from '@shared/types';

export const feeds = signal<Feed[]>([]);

export const feedsByRank = computed(() => [...feeds.value].sort((a, b) => b.rank - a.rank));
export const feedsById = computed(() => new Map(feeds.value.map(f => [f.id, f])));

export const setFeeds = (list: Feed[]) => { feeds.value = list; };
export const addFeed = (f: Feed) => { feeds.value = [...feeds.value, f]; };
export const removeFeed = (id: string) => { feeds.value = feeds.value.filter(f => f.id !== id); };
export const getFeed = (id: string) => feedsById.value.get(id);

export function updateFeed(id: string, updates: Partial<Feed>) {
  feeds.value = feeds.value.map(f =>
    f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f
  );
}
