/**
 * Unified Store Module
 *
 * Exports store objects directly - consumers destructure what they need.
 */
import { signal } from '@preact/signals';
import {
  createHorseStore,
  createFeedStore,
  createDietStore,
  createBoardStore,
  type UpdateSource,
} from '../lib/engine';

// Re-export auth module
export * from './auth';

export type { UpdateSource };

// Store instances - consumers destructure what they need
export const boardStore = createBoardStore();
export const horseStore = createHorseStore();
export const feedStore = createFeedStore();
export const dietStore = createDietStore();

// Permission-based access control
export type Permission = 'none' | 'view' | 'edit' | 'admin';
export const permission = signal<Permission>('view');
export const setPermission = (p: Permission) => { permission.value = p; };

// Computed permission helpers
export const canEdit = () => permission.value === 'edit' || permission.value === 'admin';
export const isAdmin = () => permission.value === 'admin';
