import { signal, computed } from '@preact/signals';
import type { Feed } from '@shared/types';

// Feeds signal
export const feeds = signal<Feed[]>([]);

// Derived: feeds sorted by rank (most popular first)
export const feedsByRank = computed(() => {
  return [...feeds.value].sort((a, b) => b.rank - a.rank);
});

// Derived: feed lookup by ID
export const feedsById = computed(() => {
  const map = new Map<string, Feed>();
  for (const feed of feeds.value) {
    map.set(feed.id, feed);
  }
  return map;
});

// Actions
export function setFeeds(newFeeds: Feed[]) {
  feeds.value = newFeeds;
}

export function addFeed(feed: Feed) {
  feeds.value = [...feeds.value, feed];
}

export function updateFeed(id: string, updates: Partial<Feed>) {
  feeds.value = feeds.value.map(f =>
    f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f
  );
}

export function removeFeed(id: string) {
  feeds.value = feeds.value.filter(f => f.id !== id);
}

export function getFeed(id: string): Feed | undefined {
  return feedsById.value.get(id);
}
