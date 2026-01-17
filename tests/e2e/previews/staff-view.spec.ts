/**
 * Staff View Preview - View-only permission (pair code entry)
 * 
 * Entry: Landing + pair code → view token
 * Can Do: Read-only Controller (no add/edit buttons)
 */
import { test } from '@playwright/test';
import { createBoard, createHorse, createFeed, createPreviewToken } from '../helpers/api';

test('staff_view', async ({ request }) => {
    // Seed board with sample data
    const board = await createBoard(request);
    await createHorse(request, board.id, { name: 'Thunderbolt' });
    await createHorse(request, board.id, { name: 'Lightning' });
    await createFeed(request, board.id, { name: 'Hay', unit_type: 'fraction', unit_label: 'bale' });

    // Real token from /pair endpoint
    const { token } = await createPreviewToken(request, board.pair_code);

    console.log('--------------------------------------------------');
    console.log('STAFF VIEW PREVIEW (Read-Only)');
    console.log('--------------------------------------------------');
    console.log(`Board ID:   ${board.id}`);
    console.log(`Pair Code:  ${board.pair_code}`);
    console.log('');
    console.log('TELEPORT → Controller (View-Only):');
    console.log(`localStorage.clear(); localStorage.setItem("hb_board_id", "${board.id}"); localStorage.setItem("hb_token", "${token}"); localStorage.setItem("hb_permission", "view"); window.location.href = "/controller";`);
    console.log('');
    console.log('UI EXPECTATIONS:');
    console.log('- No "Add Horse" or "Add Feed" buttons');
    console.log('- No admin settings (Displays, Staff Access)');
    console.log('- "Upgrade Access" section visible');
    console.log('--------------------------------------------------');
});

