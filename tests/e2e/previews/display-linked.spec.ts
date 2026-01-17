/**
 * Display Linked Preview - TV Board View
 * 
 * Entry: Provisioned via SSE → receives view token
 * Shows: Read-only board grid (swimlane view)
 */
import { test } from '@playwright/test';
import { createBoard, createHorse, createFeed, upsertDiet, createPreviewToken } from '../helpers/api';

test('display_linked', async ({ request }) => {
    // Seed board with enough data for meaningful grid
    const board = await createBoard(request);
    const horse1 = await createHorse(request, board.id, { name: 'Thunderbolt' });
    const horse2 = await createHorse(request, board.id, { name: 'Lightning' });
    const horse3 = await createHorse(request, board.id, { name: 'Spirit' });
    const feed1 = await createFeed(request, board.id, { name: 'Hay', unit_type: 'fraction', unit_label: 'bale' });
    const feed2 = await createFeed(request, board.id, { name: 'Grain', unit_type: 'decimal', unit_label: 'kg' });

    // Add diet entries (required for sparse grid filtering)
    await upsertDiet(request, { horse_id: horse1.id, feed_id: feed1.id, am_amount: 2, pm_amount: 1.5 });
    await upsertDiet(request, { horse_id: horse2.id, feed_id: feed1.id, am_amount: 1, pm_amount: 1 });
    await upsertDiet(request, { horse_id: horse3.id, feed_id: feed2.id, am_amount: 0.5, pm_amount: 0.75 });

    // Real token from /pair endpoint
    const { token } = await createPreviewToken(request, board.pair_code);

    console.log('--------------------------------------------------');
    console.log('DISPLAY LINKED PREVIEW (TV Board View)');
    console.log('--------------------------------------------------');
    console.log(`Board ID:   ${board.id}`);
    console.log(`Pair Code:  ${board.pair_code}`);
    console.log('');
    console.log('TELEPORT → Board View (Display):');
    console.log(`localStorage.clear(); localStorage.setItem("hb_board_id", "${board.id}"); localStorage.setItem("hb_token", "${token}"); localStorage.setItem("hb_permission", "view"); window.location.href = "/board";`);
    console.log('');
    console.log('UI EXPECTATIONS:');
    console.log('- [data-testid="board-view"] visible');
    console.log('- [data-testid="swim-lane-grid"] with horse columns and feed rows');
    console.log('- Time mode badge (AM/PM)');
    console.log('- Read-only (no FeedPad on click)');
    console.log('- TV-optimized: large fonts, high contrast');
    console.log('--------------------------------------------------');
});

