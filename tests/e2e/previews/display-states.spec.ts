
import { test } from '@playwright/test';
import { createBoard, createHorse, createFeed, upsertDiet, createPreviewToken } from '../helpers/api';

const HEADERS = { 'x-test-user-id': 'e2e-test-user' };

test('display-am', async ({ request }) => {
    // Seed board with data
    const board = await createBoard(request);

    // Force AM mode
    await request.patch(`http://localhost:5173/api/boards/${board.id}`, {
        data: { time_mode: 'AM' },
        headers: HEADERS
    });

    const horse1 = await createHorse(request, board.id, { name: 'Thunderbolt' });
    const horse2 = await createHorse(request, board.id, { name: 'Lightning' });
    const feed1 = await createFeed(request, board.id, { name: 'Hay', unit_type: 'fraction', unit_label: 'bale' });

    await upsertDiet(request, { horse_id: horse1.id, feed_id: feed1.id, am_amount: 2, pm_amount: 1.5 });
    await upsertDiet(request, { horse_id: horse2.id, feed_id: feed1.id, am_amount: 1, pm_amount: 1 });

    const { token } = await createPreviewToken(request, board.pair_code);

    console.log('--------------------------------------------------');
    console.log('DISPLAY AM PREVIEW');
    console.log(`await fetch('/api/auth/sign-out', { method: 'POST' }); localStorage.clear(); localStorage.setItem("hb_board_id", "${board.id}"); localStorage.setItem("hb_token", "${token}"); localStorage.setItem("hb_permission", "view"); window.location.href = "/board";`);
    console.log('--------------------------------------------------');
});

test('display-pm', async ({ request }) => {
    // Seed board with data
    const board = await createBoard(request);

    // Force PM mode
    await request.patch(`http://localhost:5173/api/boards/${board.id}`, {
        data: { time_mode: 'PM' },
        headers: HEADERS
    });

    const horse1 = await createHorse(request, board.id, { name: 'Thunderbolt' });
    const horse2 = await createHorse(request, board.id, { name: 'Lightning' });
    const feed1 = await createFeed(request, board.id, { name: 'Hay', unit_type: 'fraction', unit_label: 'bale' });

    await upsertDiet(request, { horse_id: horse1.id, feed_id: feed1.id, am_amount: 2, pm_amount: 1.5 });
    await upsertDiet(request, { horse_id: horse2.id, feed_id: feed1.id, am_amount: 1, pm_amount: 1 });

    const { token } = await createPreviewToken(request, board.pair_code);

    console.log('--------------------------------------------------');
    console.log('DISPLAY PM PREVIEW');
    console.log(`await fetch('/api/auth/sign-out', { method: 'POST' }); localStorage.clear(); localStorage.setItem("hb_board_id", "${board.id}"); localStorage.setItem("hb_token", "${token}"); localStorage.setItem("hb_permission", "view"); window.location.href = "/board";`);
    console.log('--------------------------------------------------');
});

test('display-provisioning', async ({ request }) => {
    console.log('--------------------------------------------------');
    console.log('DISPLAY PROVISIONING PREVIEW');
    console.log(`await fetch('/api/auth/sign-out', { method: 'POST' }); localStorage.clear(); window.location.href = "/board";`);
    console.log('--------------------------------------------------');
});
