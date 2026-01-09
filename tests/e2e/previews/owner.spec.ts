/**
 * Owner Preview - Admin permission with full access
 * 
 * Entry: Signup/Login → Session + auto-created board
 * Can Do: Everything (admin)
 */
import { test } from '@playwright/test';
import { createBoard, createHorse, createFeed, createPreviewUser, upsertDiet } from '../helpers/api';

test('owner', async ({ request }) => {
    // Seed user and board with sample data for pagination testing
    const { email, password } = await createPreviewUser(request);
    const board = await createBoard(request);

    // Create 8 horses for pagination
    const horseNames = ['Thunderbolt', 'Lightning', 'Storm', 'Shadow', 'Spirit', 'Blaze', 'Nova', 'Echo'];
    const horses = [];
    for (const name of horseNames) {
        const horse = await createHorse(request, board.id, { name });
        horses.push(horse);
    }

    // Create 6 feeds for column testing
    const feeds = [
        { name: 'Hay', unit_type: 'fraction' as const, unit_label: 'bale' },
        { name: 'Oats', unit_type: 'int' as const, unit_label: 'scoop' },
        { name: 'Carrots', unit_type: 'int' as const, unit_label: 'pieces' },
        { name: 'Supplements', unit_type: 'fraction' as const, unit_label: 'dose' },
        { name: 'Salt Block', unit_type: 'int' as const, unit_label: 'block' },
        { name: 'Water', unit_type: 'int' as const, unit_label: 'bucket' },
    ];
    const createdFeeds = [];
    for (const feed of feeds) {
        const f = await createFeed(request, board.id, feed);
        createdFeeds.push(f);
    }

    // Create diet entries for each horse/feed combo with realistic amounts
    for (const horse of horses) {
        for (const feed of createdFeeds) {
            // Vary amounts by feed type for realism
            const am = feed.name === 'Hay' ? 0.5 : feed.name === 'Oats' ? 2 : 1;
            const pm = feed.name === 'Hay' ? 1 : feed.name === 'Water' ? 2 : 1;
            await upsertDiet(request, { horse_id: horse.id, feed_id: feed.id, am_amount: am, pm_amount: pm });
        }
    }

    console.log('--------------------------------------------------');
    console.log('OWNER PREVIEW');
    console.log('--------------------------------------------------');
    console.log(`Board ID:   ${board.id}`);
    console.log(`Pair Code:  ${board.pair_code}`);
    console.log('');
    console.log('TELEPORT → Controller (Admin):');
    console.log(`await fetch('/api/auth/sign-out', { method: 'POST' }); localStorage.clear(); localStorage.setItem('hb_board_id', '${board.id}'); localStorage.setItem('hb_permission', 'admin'); await fetch('/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: '${email}', password: '${password}' }), credentials: 'include' }); window.location.href = '/controller';`);
    console.log('--------------------------------------------------');
});


