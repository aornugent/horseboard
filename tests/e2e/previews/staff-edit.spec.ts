/**
 * Staff Edit Preview - Edit permission (invite code redeemed)
 * 
 * Entry: Redeem invite code → edit token
 * Can Do: Edit via Controller (add/edit horses, feeds, diets)
 */
import { test } from '@playwright/test';
import { createBoard, createHorse, createFeed, createPreviewToken } from '../helpers/api';

test('staff_edit', async ({ request }) => {
    // Seed board with sample data
    const board = await createBoard(request);
    await createHorse(request, board.id, { name: 'Thunderbolt' });
    await createHorse(request, board.id, { name: 'Lightning' });
    await createFeed(request, board.id, { name: 'Hay', unit_type: 'fraction', unit_label: 'bale' });

    // Real token from /pair (view permission), UI control via localStorage
    const { token } = await createPreviewToken(request, board.pair_code);

    console.log('--------------------------------------------------');
    console.log('STAFF EDIT PREVIEW (Edit Permission)');
    console.log('--------------------------------------------------');
    console.log(`Board ID:   ${board.id}`);
    console.log(`Pair Code:  ${board.pair_code}`);
    console.log('');
    console.log('TELEPORT → Controller (Edit):');
    console.log(`localStorage.clear(); localStorage.setItem("hb_board_id", "${board.id}"); localStorage.setItem("hb_token", "${token}"); localStorage.setItem("hb_permission", "edit"); window.location.href = "/controller";`);
    console.log('');
    console.log('UI EXPECTATIONS:');
    console.log('- "Add Horse" and "Add Feed" buttons visible');
    console.log('- No "Generate Invite" button (admin only)');
    console.log('- No Displays section (admin only)');
    console.log('--------------------------------------------------');
});

