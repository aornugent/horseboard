// tests/unit/grid-logic.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { computeGrid } from '../../src/shared/grid-logic.js';

function timestamp(offsetMs = 0) {
    return new Date(Date.now() + offsetMs).toISOString();
}

function mockHorse(overrides = {}) {
    const id = overrides.id ?? `h-${Math.random().toString(36).slice(2, 8)}`;
    return {
        id, board_id: 'board-1', name: overrides.name ?? `Horse ${id}`,
        note: overrides.note ?? null, note_expiry: null,
        archived: overrides.archived ?? false,
        created_at: timestamp(), updated_at: timestamp(), ...overrides,
    };
}

function mockFeed(overrides = {}) {
    const id = overrides.id ?? `f-${Math.random().toString(36).slice(2, 8)}`;
    return {
        id, board_id: 'board-1', name: overrides.name ?? `Feed ${id}`,
        unit_type: 'fraction', unit_label: 'scoop', entry_options: null,
        rank: overrides.rank ?? 0, stock_level: 100, low_stock_threshold: 10,
        created_at: timestamp(), updated_at: timestamp(), ...overrides,
    };
}

function mockDiet(overrides = {}) {
    return {
        horse_id: overrides.horse_id ?? 'h-1', feed_id: overrides.feed_id ?? 'f-1',
        am_amount: overrides.am_amount ?? null, pm_amount: overrides.pm_amount ?? null,
        am_variant: overrides.am_variant ?? null, pm_variant: overrides.pm_variant ?? null,
        created_at: timestamp(), updated_at: timestamp(), ...overrides,
    };
}

// Fixtures
const horses = [
    mockHorse({ id: 'h1', name: 'Apollo' }),
    mockHorse({ id: 'h2', name: 'Bella' }),
    mockHorse({ id: 'h3', name: 'Charlie' }),
];

const feeds = [
    mockFeed({ id: 'f1', name: 'Oats', rank: 3 }),
    mockFeed({ id: 'f2', name: 'Hay', rank: 2 }),
    mockFeed({ id: 'f3', name: 'Vitamins', rank: 1 }),
];

// Apollo: Oats AM | Bella: Hay PM | Charlie: Oats+Vitamins AM+PM
const diet = [
    mockDiet({ horse_id: 'h1', feed_id: 'f1', am_amount: 2 }),
    mockDiet({ horse_id: 'h2', feed_id: 'f2', pm_amount: 1 }),
    mockDiet({ horse_id: 'h3', feed_id: 'f1', am_amount: 1, pm_amount: 1 }),
    mockDiet({ horse_id: 'h3', feed_id: 'f3', am_amount: 0.5, pm_amount: 0.5 }),
];

// ==========================================================================
// Output Structure
// ==========================================================================

describe('computeGrid output', () => {
    test('returns columns, rows, cells, page counts', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 6 });
        assert.ok(Array.isArray(r.columns));
        assert.ok(Array.isArray(r.rows));
        assert.ok(Array.isArray(r.cells));
        assert.strictEqual(typeof r.totalColumnPages, 'number');
        assert.strictEqual(typeof r.totalRowPages, 'number');
        assert.strictEqual(typeof r.hasMoreRows, 'boolean');
    });
});

// ==========================================================================
// Horse-Major Orientation
// ==========================================================================

describe('horse-major orientation', () => {
    test('columns are horses', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.columns.length, 3);
        assert.deepStrictEqual(r.columns.map(c => c.name), ['Apollo', 'Bella', 'Charlie']);
    });

    test('rows are sparse-filtered feeds for AM', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        const names = r.rows.map(f => f.name);
        assert.ok(names.includes('Oats'));
        assert.ok(names.includes('Vitamins'));
        assert.ok(!names.includes('Hay'), 'Hay is PM-only');
    });

    test('rows are sparse-filtered feeds for PM', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'PM', page: 0, pageSize: 10 });
        const names = r.rows.map(f => f.name);
        assert.ok(names.includes('Hay'));
        assert.ok(names.includes('Oats'));
        assert.ok(names.includes('Vitamins'));
    });

    test('cells indexed [colIdx][rowIdx]', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        const oatsIdx = r.rows.findIndex(f => f.name === 'Oats');
        assert.strictEqual(r.cells[0][oatsIdx].value, 2, 'Apollo AM Oats = 2');
    });

    test('includes horse notes in columns', async () => {
        const h = [mockHorse({ id: 'h1', name: 'Apollo', note: 'Colicky' }), ...horses.slice(1)];
        const r = computeGrid({ horses: h, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.columns[0].note, 'Colicky');
    });

    test('rows are ordered by feed rank ascending', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        const ranks = r.rows.map(f => feeds.find(x => x.id === f.id)?.rank);
        assert.deepStrictEqual(ranks, [...ranks].sort((a, b) => a - b));
    });
});

// ==========================================================================
// Feed-Major Orientation
// ==========================================================================

describe('feed-major orientation', () => {
    test('columns are sparse-filtered feeds', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'feed-major', timeMode: 'AM', page: 0, pageSize: 10 });
        const names = r.columns.map(f => f.name);
        assert.ok(names.includes('Oats'));
        assert.ok(names.includes('Vitamins'));
    });

    test('rows are horses eating visible feeds', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'feed-major', timeMode: 'AM', page: 0, pageSize: 10 });
        const names = r.rows.map(h => h.name);
        assert.ok(names.includes('Apollo'));
        assert.ok(names.includes('Charlie'));
        assert.ok(!names.includes('Bella'), 'Bella has no AM feeds');
    });

    test('cells respect flipped indexing', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'feed-major', timeMode: 'AM', page: 0, pageSize: 10 });
        const oatsIdx = r.columns.findIndex(f => f.name === 'Oats');
        const apolloIdx = r.rows.findIndex(h => h.name === 'Apollo');
        assert.strictEqual(r.cells[oatsIdx][apolloIdx].value, 2);
    });

    test('includes horse notes in rows', async () => {
        const h = [mockHorse({ id: 'h1', name: 'Apollo', note: 'Colicky' }), ...horses.slice(1)];
        const r = computeGrid({ horses: h, feeds, diet, orientation: 'feed-major', timeMode: 'AM', page: 0, pageSize: 10 });
        const apollo = r.rows.find(h => h.name === 'Apollo');
        assert.strictEqual(apollo?.note, 'Colicky');
    });
});

// ==========================================================================
// Pagination (Columns)
// ==========================================================================

describe('column pagination', () => {
    test('slices columns to pageSize', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 2 });
        assert.strictEqual(r.columns.length, 2);
        assert.deepStrictEqual(r.columns.map(c => c.name), ['Apollo', 'Bella']);
    });

    test('page 1 shows next slice', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 1, pageSize: 2 });
        assert.strictEqual(r.columns.length, 1);
        assert.strictEqual(r.columns[0].name, 'Charlie');
    });

    test('totalColumnPages calculated correctly', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 2 });
        assert.strictEqual(r.totalColumnPages, 2);
    });

    test('sparse filters rows based on visible columns only', async () => {
        // Page 0, pageSize 1 = only Apollo. Apollo eats Oats in AM.
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 1 });
        assert.strictEqual(r.rows.length, 1);
        assert.strictEqual(r.rows[0].name, 'Oats');
    });

    test('no pagination when items <= pageSize', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 100 });
        assert.strictEqual(r.totalColumnPages, 1);
    });

    test('pageSize: Infinity returns all columns (reference view)', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: Infinity });
        assert.strictEqual(r.columns.length, 3);
        assert.strictEqual(r.totalColumnPages, 1);
        assert.deepStrictEqual(r.columns.map(c => c.name), ['Apollo', 'Bella', 'Charlie']);
    });

    test('empty page returns empty arrays', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 99, pageSize: 2 });
        assert.strictEqual(r.columns.length, 0);
        assert.strictEqual(r.rows.length, 0);
    });
});

// ==========================================================================
// 2D Pagination (Rows)
// ==========================================================================

describe('row pagination (2D)', () => {
    const manyFeeds = Array.from({ length: 10 }, (_, i) => mockFeed({ id: `f${i}`, name: `Feed${i}`, rank: i }));
    const bigDiet = manyFeeds.map(f => mockDiet({ horse_id: 'h1', feed_id: f.id, am_amount: 1 }));

    test('hasMoreRows true when rows exceed rowPageSize', async () => {
        const r = computeGrid({
            horses: [horses[0]], feeds: manyFeeds, diet: bigDiet,
            orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10, rowPageSize: 5,
        });
        assert.strictEqual(r.hasMoreRows, true);
        assert.strictEqual(r.rows.length, 5);
        assert.strictEqual(r.totalRowPages, 2);
    });

    test('hasMoreRows false when rows fit', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.hasMoreRows, false);
    });

    test('rowPage slices row axis', async () => {
        const p0 = computeGrid({
            horses: [horses[0]], feeds: manyFeeds, diet: bigDiet,
            orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10, rowPage: 0, rowPageSize: 5,
        });
        const p1 = computeGrid({
            horses: [horses[0]], feeds: manyFeeds, diet: bigDiet,
            orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10, rowPage: 1, rowPageSize: 5,
        });
        assert.strictEqual(p0.rows.length, 5);
        assert.strictEqual(p1.rows.length, 5);
        assert.notDeepStrictEqual(p0.rows.map(r => r.id), p1.rows.map(r => r.id));
    });

    test('remainingRows shows correct count on first row page', async () => {
        const r = computeGrid({
            horses: [horses[0]], feeds: manyFeeds, diet: bigDiet,
            orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10, rowPage: 0, rowPageSize: 3,
        });
        assert.strictEqual(r.remainingRows, 7, '10 total - 3 visible = 7 remaining');
    });

    test('remainingRows shows correct count on middle row page', async () => {
        const r = computeGrid({
            horses: [horses[0]], feeds: manyFeeds, diet: bigDiet,
            orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10, rowPage: 1, rowPageSize: 3,
        });
        assert.strictEqual(r.remainingRows, 4, '10 total - 6 shown = 4 remaining');
    });

    test('remainingRows is 0 on last row page', async () => {
        const r = computeGrid({
            horses: [horses[0]], feeds: manyFeeds, diet: bigDiet,
            orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10, rowPage: 3, rowPageSize: 3,
        });
        assert.strictEqual(r.remainingRows, 0);
        assert.strictEqual(r.hasMoreRows, false);
    });

    test('remainingRows is 0 when all rows fit', async () => {
        const r = computeGrid({ horses, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.remainingRows, 0);
    });
});

// ==========================================================================
// Edge Cases
// ==========================================================================

describe('edge cases', () => {
    test('empty diet shows all columns, no rows', async () => {
        const r = computeGrid({ horses, feeds, diet: [], orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.columns.length, 3);
        assert.strictEqual(r.rows.length, 0);
    });

    test('no horses returns empty', async () => {
        const r = computeGrid({ horses: [], feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.columns.length, 0);
        assert.strictEqual(r.rows.length, 0);
    });

    test('archived horses excluded', async () => {
        const h = [...horses, mockHorse({ id: 'h4', name: 'Archived', archived: true })];
        const r = computeGrid({ horses: h, feeds, diet, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.ok(!r.columns.map(c => c.name).includes('Archived'));
    });

    test('variant-only entries included', async () => {
        const d = [mockDiet({ horse_id: 'h1', feed_id: 'f1', am_variant: 'Small' })];
        const r = computeGrid({ horses, feeds, diet: d, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.rows.length, 1);
        assert.strictEqual(r.cells[0][0].variant, 'Small');
    });

    test('zero amounts excluded', async () => {
        const d = [mockDiet({ horse_id: 'h1', feed_id: 'f1', am_amount: 0 })];
        const r = computeGrid({ horses, feeds, diet: d, orientation: 'horse-major', timeMode: 'AM', page: 0, pageSize: 10 });
        assert.strictEqual(r.rows.length, 0);
    });
    test('empty page returns complete GridOutput shape including remainingRows', async () => {
        const r = computeGrid({
            horses, feeds, diet,
            orientation: 'horse-major', timeMode: 'AM',
            page: 99, pageSize: 2
        });
        assert.strictEqual(r.remainingRows, 0);
    });
});

describe('2D pagination helpers', () => {
    test('getTotal2DPages returns product of column and row pages', async () => {
        const { getTotal2DPages } = await import('../../src/shared/grid-logic.js');
        assert.strictEqual(getTotal2DPages(3, 2), 6);
        assert.strictEqual(getTotal2DPages(1, 1), 1);
    });

    test('get2DPageCoords advances rows first (down-then-across)', async () => {
        const { get2DPageCoords } = await import('../../src/shared/grid-logic.js');
        assert.deepStrictEqual(get2DPageCoords(0, 2), { columnPage: 0, rowPage: 0 });
        assert.deepStrictEqual(get2DPageCoords(1, 2), { columnPage: 0, rowPage: 1 });
        assert.deepStrictEqual(get2DPageCoords(2, 2), { columnPage: 1, rowPage: 0 });
        assert.deepStrictEqual(get2DPageCoords(3, 2), { columnPage: 1, rowPage: 1 });
    });

    test('get2DPageCoords handles single row page', async () => {
        const { get2DPageCoords } = await import('../../src/shared/grid-logic.js');
        assert.deepStrictEqual(get2DPageCoords(0, 1), { columnPage: 0, rowPage: 0 });
        assert.deepStrictEqual(get2DPageCoords(2, 1), { columnPage: 2, rowPage: 0 });
    });
});
