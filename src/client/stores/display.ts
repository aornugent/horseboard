import { signal, computed } from '@preact/signals';
import { getEffectiveTimeMode } from '@shared/time-mode';
import type { Display, TimeMode } from '@shared/types';

// Display settings signal
export const display = signal<Display | null>(null);

// Derived signals
export const configuredMode = computed<TimeMode>(() => display.value?.timeMode ?? 'AUTO');
export const timezone = computed(() => display.value?.timezone ?? 'UTC');
export const overrideUntil = computed(() => display.value?.overrideUntil ?? null);
export const zoomLevel = computed(() => display.value?.zoomLevel ?? 2);
export const currentPage = computed(() => display.value?.currentPage ?? 0);

// Computed effective time mode using shared logic
export const effectiveTimeMode = computed<'AM' | 'PM'>(() => {
  return getEffectiveTimeMode(
    configuredMode.value,
    overrideUntil.value,
    timezone.value
  );
});

// Actions
export function setDisplay(newDisplay: Display) {
  display.value = newDisplay;
}

export function updateTimeMode(mode: TimeMode, overrideUntilDate?: string | null) {
  if (display.value) {
    display.value = {
      ...display.value,
      timeMode: mode,
      overrideUntil: overrideUntilDate ?? null,
      updatedAt: new Date().toISOString(),
    };
  }
}

export function setZoomLevel(level: 1 | 2 | 3) {
  if (display.value) {
    display.value = {
      ...display.value,
      zoomLevel: level,
      updatedAt: new Date().toISOString(),
    };
  }
}

export function setCurrentPage(page: number) {
  if (display.value) {
    display.value = {
      ...display.value,
      currentPage: page,
      updatedAt: new Date().toISOString(),
    };
  }
}
