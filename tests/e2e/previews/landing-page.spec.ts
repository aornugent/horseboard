/**
 * Landing Page Preview - Unauthenticated visitor
 * 
 * Entry: Fresh browser → / with no token
 * Shows: Code entry, signup/login links
 */
import { test } from '@playwright/test';
import { createBoard } from '../helpers/api';

test('landing_page', async ({ request }) => {
    // Create a board so we have a valid pair code to display
    const board = await createBoard(request);

    console.log('--------------------------------------------------');
    console.log('LANDING PAGE PREVIEW (Unauthenticated)');
    console.log('--------------------------------------------------');
    console.log(`Board ID:   ${board.id}`);
    console.log(`Pair Code:  ${board.pair_code}`);
    console.log('');
    console.log('TELEPORT → Landing Page:');
    console.log('localStorage.clear(); window.location.href = "/";');
    console.log('');
    console.log('UI EXPECTATIONS:');
    console.log('- [data-testid="landing-view"] visible');
    console.log('- [data-testid="landing-code-input"] for pair code entry');
    console.log('- [data-testid="landing-signup-link"] and [data-testid="landing-login-link"]');
    console.log('- No authenticated elements');
    console.log('--------------------------------------------------');
});
