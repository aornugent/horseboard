/**
 * Display Unlinked Preview - Provisioning UI
 * 
 * Entry: Fresh browser → /board with no token
 * Shows: Provisioning code (6-char) waiting for owner to link
 */
import { test } from '@playwright/test';

test('display_unlinked', async () => {
    console.log('--------------------------------------------------');
    console.log('DISPLAY UNLINKED PREVIEW (Provisioning UI)');
    console.log('--------------------------------------------------');
    console.log('No board ID needed - fresh state shows provisioning.');
    console.log('');
    console.log('TELEPORT → Provisioning View:');
    console.log('localStorage.clear(); window.location.href = "/board";');
    console.log('');
    console.log('UI EXPECTATIONS:');
    console.log('- [data-testid="provisioning-view"] visible');
    console.log('- [data-testid="provisioning-code"] shows 6-char code');
    console.log('- Large, TV-optimized typography');
    console.log('- No navigation or interactive elements');
    console.log('--------------------------------------------------');
});
