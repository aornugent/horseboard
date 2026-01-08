/**
 * Owner Preview - Admin permission with full access
 * 
 * Entry: Signup/Login → Session + auto-created board
 * Can Do: Everything (admin)
 */
import { test } from '@playwright/test';
import { createBoard, createHorse, createFeed, createPreviewUser } from '../helpers/api';

test('owner', async ({ request }) => {
    // Seed user and board with sample data
    const { email, password } = await createPreviewUser(request);
    const board = await createBoard(request);
    await createHorse(request, board.id, { name: 'Thunderbolt' });
    await createHorse(request, board.id, { name: 'Lightning' });
    await createFeed(request, board.id, { name: 'Hay', unit_type: 'fraction', unit_label: 'bale' });

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


