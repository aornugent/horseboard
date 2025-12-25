export type TimeMode = 'AUTO' | 'AM' | 'PM';

export interface Horse {
  id: string;
  displayId: string;
  name: string;
  note: string | null;
  noteExpiry: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Feed {
  id: string;
  displayId: string;
  name: string;
  unit: 'scoop' | 'ml' | 'sachet' | 'biscuit';
  rank: number;
  stockLevel: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface DietEntry {
  horseId: string;
  feedId: string;
  amAmount: number | null;
  pmAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Display {
  id: string;
  pairCode: string;
  timezone: string;
  timeMode: TimeMode;
  overrideUntil: string | null;
  zoomLevel: 1 | 2 | 3;
  currentPage: number;
  createdAt: string;
  updatedAt: string;
}
