# Production Code Changes Needed for Stable Test Selectors

The code review identified fragile selectors in test files. These selectors need corresponding `data-testid` attributes added to production code.

## Required Changes

### 1. Token Management UI (SettingsTab → Permissions → API Tokens)

**File**: `src/components/SettingsTab.tsx` (or similar)

Add these data-testid attributes:

```tsx
// Create Token Button
<button data-testid="create-token-btn" onClick={handleCreateToken}>
  Create Token
</button>

// Create Token Modal
<input
  data-testid="token-name-input"
  placeholder="Token name (e.g., Barn iPad)"
  value={tokenName}
/>

<select data-testid="token-permission-select" value={permission}>
  <option value="view">View Only</option>
  <option value="edit">Edit</option>
</select>

<button data-testid="create-token-submit">Create Token</button>

// Token Display Modal
<div data-testid="token-value">{generatedToken}</div>
<button data-testid="token-modal-done">Done</button>

// Token List Item
<div data-testid="token-list-item">
  {tokenName}
  <button data-testid="revoke-token-btn">Revoke</button>
</div>
```

### 2. Display Provisioning UI (SettingsTab → Displays)

**File**: `src/components/SettingsTab.tsx`

```tsx
// Add Display Button
<button data-testid="add-display-btn">Link Display</button>

// Link Display Modal
<div data-testid="link-display-modal">
  <input
    data-testid="provisioning-input"
    placeholder="Enter code from TV"
  />
  <button data-testid="provisioning-submit">Link Display</button>
  <div data-testid="provisioning-error">{error}</div>
</div>

// Linked Display Item
<div data-testid="settings-device-name">Display {code}</div>
<button data-testid="unlink-display-btn">Unlink</button>
```

### 3. TV Provisioning View

**File**: `src/components/ProvisioningView.tsx` (or BoardView provisioning state)

```tsx
<div data-testid="provisioning-view">
  <div data-testid="provisioning-code">{displayCode}</div>
</div>
```

### 4. Invite Error Message

**File**: `src/components/SettingsTab.tsx`

```tsx
// In invite redemption section
<div data-testid="invite-error">{inviteError}</div>
```

## Why This Matters

**Fragile selectors break easily:**
```typescript
// ❌ Breaks when text changes
page.locator('text=Permissions')

// ❌ Breaks when CSS refactored
page.locator('.token-value')

// ❌ Breaks when placeholder updated
page.fill('input[placeholder*="name"]')
```

**Stable selectors are reliable:**
```typescript
// ✅ Only breaks if intentionally removed
page.locator(selectors.tokenValueDisplay)
```

## Implementation Priority

**High Priority** (affects existing tests):
1. Token management selectors (auth-edge.spec.ts lines 37-131)
2. Display provisioning selectors (provisioning.spec.ts)
3. Invite error selector (auth-edge.spec.ts lines 133-179)

**Medium Priority**:
4. Additional Settings selectors for consistency

## Verification

After adding data-testid attributes, verify with:
```bash
npm run test:e2e -- auth-edge.spec.ts
npm run test:e2e -- provisioning.spec.ts
```

Tests should pass without changing test code (selectors already added to selectors.ts).
