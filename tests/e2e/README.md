# HorseBoard E2E Tests

## Overview

This directory contains end-to-end tests for the HorseBoard application using Playwright.

## Test Structure

- `workflows.spec.js` - Complete user workflows (pairing, editing, syncing)
- `controller.spec.js` - Controller app specific tests
- `display.spec.js` - Display app specific tests
- `a11y.spec.js` - Accessibility compliance tests
- `edge-cases.spec.js` - Edge cases and resilience testing
- `fixtures.js` - Reusable test fixtures (RECOMMENDED)

## Using Test Fixtures

The `fixtures.js` file provides reusable test helpers that automatically handle cleanup and reduce code duplication.

### Example: Using the `display` fixture

```javascript
import { test, expect } from './fixtures.js';

test('my test', async ({ display }) => {
  const { displayPage, displayId, pairCode } = display;

  // Your test code here
  // Display is automatically created and will be cleaned up after the test
});
```

### Example: Using the `pairedController` fixture

```javascript
import { test, expect } from './fixtures.js';

test('my test', async ({ pairedController }) => {
  const { controllerPage, displayPage, displayId } = pairedController;

  // Your test code here
  // Display and controller are automatically created, paired, and cleaned up
});
```

## Best Practices

### ✅ DO

- Use fixtures for automatic cleanup
- Use `data-testid` attributes when available
- Use condition-based waits (`waitFor`, `waitForSelector`)
- Write descriptive test names
- Clean up test data in `afterEach` hooks

### ❌ DON'T

- Use `waitForTimeout()` - use condition-based waits instead
- Use `expect(locator).toBeTruthy()` - use `expect(await locator.count()).toBeGreaterThan(0)` or `.toBeVisible()`
- Leave test data in the database after tests complete
- Use brittle text matching - prefer flexible matchers

## Selector Strategy

Prefer selectors in this order:
1. `data-testid` attributes (most stable)
2. ID selectors (`#element-id`)
3. Semantic selectors (`role`, `label`)
4. Class selectors (`.class-name`) - least stable

## Running Tests

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/display.spec.js

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug

# View test report
npx playwright show-report
```

## CI/CD

Tests run automatically on push/PR via GitHub Actions. The CI environment:
- Uses `chromium` browser only
- Retries failed tests 2 times
- Runs tests sequentially (not parallel)
- Starts dev server automatically via `playwright.config.js`

## Troubleshooting

### Test is flaky
- Replace `waitForTimeout()` with condition-based waits
- Increase timeout values if needed
- Check for race conditions in async operations

### Element not found
- Verify the selector matches the actual HTML
- Check if element is in an iframe
- Ensure proper wait conditions before interacting

### State leakage between tests
- Use fixtures for automatic cleanup
- Add `afterEach` hooks to delete test data
- Verify tests can run in any order
