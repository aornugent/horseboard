// src/shared/grid-logic.ts
import type { Horse, Feed, DietEntry, EffectiveTimeMode, BoardOrientation } from './resources';


export interface GridInput {
    horses: Horse[];
    feeds: Feed[];
    diet: DietEntry[];
    orientation: BoardOrientation;
    timeMode: EffectiveTimeMode;
    page: number;
    pageSize: number;
    rowPage?: number;
    rowPageSize?: number;
}

export interface GridItem {
    id: string;
    name: string;
    note?: string | null;
    note_expiry?: string | null;
    unitConfig?: {
        unit_type: string; // Stored as string to avoid strict type deps if needed, or import UnitType
        unit_label: string;
        entry_options: string | null;
    };
}

export interface GridCell {
    value: number | null;
    variant: string | null;
}

export interface GridOutput {
    columns: GridItem[];
    rows: GridItem[];
    cells: GridCell[][];
    totalColumnPages: number;
    totalRowPages: number;
    hasMoreRows: boolean;
    remainingRows: number;
}

export function computeGrid(input: GridInput): GridOutput {
    const { horses, feeds, diet, orientation, timeMode, page, pageSize } = input;
    const rowPage = input.rowPage ?? 0;
    const rowPageSize = input.rowPageSize ?? Infinity;

    // 1. Filter and prepare eligible items
    const activeHorses = horses.filter(h => !h.archived);

    // 2. Determine Primary and Secondary axis items
    let primaryItems: (Horse | Feed)[];
    let secondaryItems: (Horse | Feed)[];

    if (orientation === 'horse-major') {
        primaryItems = activeHorses;
        // Feeds are secondary, verify sort order
        secondaryItems = [...feeds].sort((a, b) => a.rank - b.rank);
    } else { // feed-major
        // Feeds are primary, sorted by rank
        primaryItems = [...feeds].sort((a, b) => a.rank - b.rank);
        secondaryItems = activeHorses;
    }

    // 3. Pagination (Primary Axis)
    const totalColumnPages = Math.ceil(primaryItems.length / pageSize) || 1;
    // Handle empty page edge case
    if (page >= totalColumnPages && primaryItems.length > 0) {
        return {
            columns: [],
            rows: [],
            cells: [],
            totalColumnPages,
            totalRowPages: 0,
            hasMoreRows: false
        };
    }

    const visiblePrimaryItems = primaryItems.slice(page * pageSize, (page + 1) * pageSize);

    // 4. Sparse Filtering (Secondary Axis)
    // Identify which secondary items are relevant for the *visible* primary items
    const relevantSecondaryIds = new Set<string>();

    // Helper to check if a diet entry is valid for current timeMode
    const isEntryRelevant = (entry: DietEntry) => {
        if (timeMode === 'AM') {
            return (entry.am_amount !== null && entry.am_amount > 0) || !!entry.am_variant;
        } else { // PM
            return (entry.pm_amount !== null && entry.pm_amount > 0) || !!entry.pm_variant;
        }
    };

    const relevantDiet = diet.filter(isEntryRelevant);

    for (const pItem of visiblePrimaryItems) {
        for (const entry of relevantDiet) {
            // Check if entry matches this primary item
            const matchesPrimary = orientation === 'horse-major'
                ? entry.horse_id === pItem.id
                : entry.feed_id === pItem.id;

            if (matchesPrimary) {
                // Add the *other* id to relevant set
                const secondaryId = orientation === 'horse-major' ? entry.feed_id : entry.horse_id;
                relevantSecondaryIds.add(secondaryId);
            }
        }
    }

    const visibleSecondaryItemsAll = secondaryItems.filter(item => relevantSecondaryIds.has(item.id));

    // 5. Pagination (Secondary Axis / Rows)
    const totalRowPages = Math.ceil(visibleSecondaryItemsAll.length / rowPageSize) || 1;
    const visibleSecondaryItems = visibleSecondaryItemsAll.slice(rowPage * rowPageSize, (rowPage + 1) * rowPageSize);
    const hasMoreRows = (rowPage + 1) * rowPageSize < visibleSecondaryItemsAll.length;
    const remainingRows = Math.max(0, visibleSecondaryItemsAll.length - (rowPage + 1) * rowPageSize);

    // 6. Build GridOutput
    const columns: GridItem[] = visiblePrimaryItems.map(item => ({
        id: item.id,
        name: item.name,
        // Helper to safely access note if it exists (Horse has note, Feed doesn't in strict sense but spread handles it or manual check)
        note: 'note' in item ? item.note : undefined,
        note_expiry: 'note_expiry' in item ? item.note_expiry : undefined,
        unitConfig: 'unit_type' in item ? {
            unit_type: item.unit_type,
            unit_label: item.unit_label,
            entry_options: item.entry_options
        } : undefined
    }));

    const rows: GridItem[] = visibleSecondaryItems.map(item => ({
        id: item.id,
        name: item.name,
        note: 'note' in item ? item.note : undefined,
        note_expiry: 'note_expiry' in item ? item.note_expiry : undefined,
        unitConfig: 'unit_type' in item ? {
            unit_type: item.unit_type,
            unit_label: item.unit_label,
            entry_options: item.entry_options
        } : undefined
    }));

    // 7. Build Cells
    // cells[colIdx][rowIdx]
    const cells: GridCell[][] = visiblePrimaryItems.map(pItem => {
        return visibleSecondaryItems.map(sItem => {
            const hId = orientation === 'horse-major' ? pItem.id : sItem.id;
            const fId = orientation === 'horse-major' ? sItem.id : pItem.id;

            const entry = relevantDiet.find(d => d.horse_id === hId && d.feed_id === fId);

            if (!entry) {
                return { value: null, variant: null };
            }

            if (timeMode === 'AM') {
                return {
                    value: entry.am_amount ?? null,
                    variant: entry.am_variant ?? null
                };
            } else {
                return {
                    value: entry.pm_amount ?? null,
                    variant: entry.pm_variant ?? null
                };
            }
        });
    });

    return {
        columns,
        rows,
        cells,
        totalColumnPages,
        totalRowPages,
        hasMoreRows,
        remainingRows
    };
}
