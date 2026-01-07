import { signal } from '@preact/signals';

const PERMISSION_KEY = 'hb_permission';
const storedPermission = typeof localStorage !== 'undefined' ? localStorage.getItem(PERMISSION_KEY) : null;

export type Permission = 'none' | 'view' | 'edit' | 'admin';
export const permission = signal<Permission>((storedPermission as Permission) || 'view');
export const setPermission = (p: Permission) => { permission.value = p; };
