import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Playwright configuration for "Preview" mode.
 * 
 * Usage:
 *   npm run preview [test-name]
 * 
 * Behavior:
 * - Runs ONLY tests in tests/e2e/previews
 * - Uses the same global setup (DB wipe) as main tests
 * - Fails fast (1 failure max)
 * - Retains traces/screenshots for debugging
 */
export default defineConfig({
    ...baseConfig,
    testDir: './tests/e2e/previews',

    // Fail immediately - we just want to set up state
    maxFailures: 1,

    // Don't retry, just fail
    retries: 0,

    // Inherit projects but ensuring we only run one worker to avoid DB locking issues
    // (though base config already sets workers: 1)
    workers: 1,

    // Override the ignore pattern from base config to allow preview tests to run
    testIgnore: [],

    use: {
        ...baseConfig.use,
        // Always collect trace for previews so we can see what happened if it fails
        trace: 'on',
    },

    // Always start fresh server for previews - never reuse an existing dev server
    // that may have been started without NODE_ENV=test
    webServer: {
        command: 'NODE_ENV=test npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: false,
        timeout: 120 * 1000,
    },
});
