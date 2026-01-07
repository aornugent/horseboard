import { signal } from '@preact/signals';
import { TOKEN_STORAGE_KEY, STORAGE_KEY } from '../constants';

export const accessToken = signal<string | null>(typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null);
export const boardId = signal<string | null>(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
