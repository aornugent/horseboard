# User Paths & Critical Assertions

This document serves as the source of truth for the multi-tenant architecture refactor. It defines the specific paths users take and the assertions that must be met for each scenario.

---

## Part 1: User Stories & Assertions

### Story A: The Owner (Happy Path)

**Scenario:** A new Barn Manager signs up and immediately manages their stable.

#### User Path

1. **User visits `/` on phone** → Sees landing screen with "Enter 6-digit code" as primary action
2. **User clicks "I'm the owner"** → Routed to `/signup`
3. **Signs Up** (Name/Email/Pass)
4. **System:** Detects user has 0 boards → Auto-creates board "My Stable" → Redirects to `/controller`
5. **User lands on Horses Tab** (Empty State)

#### Critical Assertions

- [ ] User has **admin** permission
- [ ] Board `account_id` matches User ID
- [ ] No "Pairing View" is shown; they go straight to the app
- [ ] All edit controls visible immediately

---

### Story B: The "Dumb" TV (Hardware Provisioning)

**Scenario:** Linking a new TV to the stable.

#### User Path

1. **TV:** Opens `/board`. Checks `localStorage` (empty). Displays giant code `99-AA-BB`. Polls `/api/devices/poll`
2. **Owner (Phone):** Settings → Displays → "Link Display". Enters `99-AA-BB`
3. **System:** Validates code → Generates display token → Links to Owner's Board
4. **TV:** Poll returns `{ token: "hb_..." }`. TV saves token → Reloads

#### Critical Assertions

- [ ] TV now renders the Grid View
- [ ] TV has **view** permission
- [ ] TV persists token across reloads

---

### Story C: Remote Control Mode (Staff View-Only)

**Scenario:** A groom wants to see notes and control the TV pages without an account.

#### User Path

1. **Context:** TV is running. Header shows permanent Pair Code (e.g., `123456`)
2. **Phone:** Visitor loads `/`. Enters `123456` in the code input
3. **System:** Returns **view** token
4. **Phone:** Loads Controller UI in read-only mode

#### Critical Assertions

- [ ] "Add Horse" / "Add Feed" buttons are **HIDDEN**
- [ ] Clicking a Horse shows details (Read Only)
- [ ] **Crucial:** Pagination controls (Next/Prev Page) ARE VISIBLE and functional (User can drive the TV)

---

### Story D: Generating Invites (Owner)

**Scenario:** Owner needs to give staff Edit access.

#### User Path

1. **Owner** goes to Settings → Permissions → "Generate Invite Code"
2. **System** returns short code `555888` (Valid 15 mins)

#### Critical Assertions

- [ ] Only **Admins** can generate this
- [ ] Code is **distinct** from the permanent Board Pair Code

---

### Story E: Redeeming Invites

**Scenario:** A user (who might already be a Visitor) enters an Invite Code to get Edit access.

#### User Path

1. **User** (currently View Only) goes to Settings → "Enter Invite Code"
2. **Inputs** `555888`
3. **System:** Exchanges code for permanent **edit** token
4. **Client:** Overwrites `hb_token` in `localStorage`. Triggers full reload

#### Critical Assertions

- [ ] App does not crash during token swap
- [ ] "Add Horse" buttons appear immediately after reload
- [ ] Old View token is abandoned (orphaned)

---

### Story F: Returning User (Session Restore)

**Scenario:** User reloads the app after previously connecting.

#### User Path

1. **User** opens `/` or `/controller`
2. **System:** Checks `localStorage` for stored board ID
3. **If found:** Auto-redirects to `/controller`, restores session
4. **Board loads** with same permission level as before

#### Critical Assertions

- [ ] No re-pairing required
- [ ] Permission level persisted correctly
- [ ] SSE reconnects automatically

---

## Part 2: Core UX Model

### Design Principles

> "There is one board. People interact with it at different permission levels.
> Access always starts with a 6-digit code."

The UI reinforces this everywhere.

### Primary Actors

| Actor | Description | Entry Point |
|-------|-------------|-------------|
| **Board (TV)** | Passive display. Shows 6-digit code when idle/unlinked. Code grants view + board controls only. | `/board` |
| **Staff** | Casual, repeat visitors. Enter code once, get sticky view-only access. Can page feeds / control board. Never see "accounts", "tokens", or "setup". | `/` → Enter code |
| **Owner/Manager** | Power user with expanded surfaces. Can generate codes, manage displays, manage permissions. | `/` → Sign up/in |

### What Disappears

| Concept | Replacement |
|---------|-------------|
| ClaimBoard | Provisioning replaces it entirely. Boards aren't "claimed"; displays are linked. |
| Token language in UI | Tokens remain internal plumbing only |
| Pairing vs invite vs token | Users only ever "enter a code" |
| Tokens tab | Consolidated into Settings → Permissions |

---

## Part 3: Entry & Routing UX

### Landing Page (`/`)

The `/` route becomes a single, calm entry point that works for everyone without asking them to self-identify.

#### Primary Action (Front and center)

```
┌─────────────────────────────────────┐
│                                     │
│           HorseBoard                │
│     Barn Feed Management System     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      Enter 6-digit code     │    │
│  │      [______123456______]   │    │
│  │                             │    │
│  │        [ Connect ]          │    │
│  └─────────────────────────────┘    │
│                                     │
│         ─────── or ───────          │
│                                     │
│     I'm the owner / manager         │
│           Sign in                   │
│                                     │
└─────────────────────────────────────┘
```

#### Secondary Actions (Quiet, optional)

Below or behind a subtle divider:
- "I'm the owner / manager" → `/signup`
- "Sign in" → `/login`

These are not required to proceed.

#### Routing Behavior

| Condition | Action |
|-----------|--------|
| Valid 6-digit code entered | Exchange for access, store in localStorage, route to `/controller` |
| User signs in (no board) | Route to `/controller`, prompt to create board or link display |
| Sticky access exists | Auto-redirect to `/controller` |
| User goes to `/board` | TV provisioning flow (never navigated by humans) |

---

## Part 4: Settings Tab Organization

### Current State (Problems)

1. **Mixed concerns:** Time Mode, Zoom, Timezone mixed with Account/Displays
2. **TokensTab separate:** Admin-only tab that should be in Settings
3. **Display controls in Settings:** Should be in Board tab
4. **No clear sections:** Hard to find what you need

### Target State (Redesign)

Settings becomes clearly segmented based on user role:

#### For All Users

```
┌─────────────────────────────────────┐
│ Settings                            │
├─────────────────────────────────────┤
│                                     │
│ ACCOUNT                             │
│ ┌─────────────────────────────────┐ │
│ │ Jane Smith                      │ │
│ │ jane@stable.com                 │ │
│ │ Role: Owner                     │ │
│ │                                 │ │
│ │ [Sign Out]                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ UPGRADE ACCESS (view-only users)    │
│ ┌─────────────────────────────────┐ │
│ │ Have an invite code?            │ │
│ │ [Enter Invite Code]             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ BOARD INFO                          │
│ ┌─────────────────────────────────┐ │
│ │ Pair Code: 123456               │ │
│ │ Board ID: abc123...             │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

#### For Owners/Admins (Additional Sections)

```
│ DISPLAYS                            │
│ ┌─────────────────────────────────┐ │
│ │ Barn TV         [Unlink]        │ │
│ │ Added: Jan 1, 2026              │ │
│ │                                 │ │
│ │ [Link New Display]              │ │
│ │                                 │ │
│ │ Timezone: Sydney (AEST)    [▼]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ PERMISSIONS                         │
│ ┌─────────────────────────────────┐ │
│ │ Staff Access                    │ │
│ │ Generate a temporary code to    │ │
│ │ give staff 'Edit' access        │ │
│ │                                 │ │
│ │ [Generate Invite Code]          │ │
│ │                                 │ │
│ │ ─────────────────────────────── │ │
│ │                                 │ │
│ │ API Tokens (Advanced)           │ │
│ │ For developers and integrations │ │
│ │                                 │ │
│ │ • Barn iPad (edit) [Revoke]     │ │
│ │ • Staff Phone (view) [Revoke]   │ │
│ │                                 │ │
│ │ [Create Token]                  │ │
│ └─────────────────────────────────┘ │
```

### Board Tab: Display Controls Drawer

Move Time Mode and Zoom controls from Settings to Board tab:

```
┌─────────────────────────────────────┐
│ Board Preview                  [AM] │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [◀ Allocations] Page 1 [Next ▶] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │     [TV Preview Grid]           │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Display Controls ──────────────┐ │
│ │                                 │ │
│ │ Time Mode  [Auto] [AM] [PM]     │ │
│ │                                 │ │
│ │ Zoom       [S] [M] [L]          │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## Part 5: Implementation Plan

### Phase 1: Landing Page Redesign

**Goal:** Single entry point with 6-digit code as primary action

#### Tasks

1. **Update `Landing.tsx`**
   - Replace current dual-link layout with code entry form
   - Add primary "Connect" button
   - Add secondary "I'm the owner" and "Sign in" links
   - Handle code submission → call `pairWithCode()`
   - On success → store in localStorage → navigate to `/controller`

2. **Update `Router.tsx`**
   - Add auto-redirect logic: if localStorage has board ID, skip Landing
   - Redirect `/controller` without stored board to `/` (Landing)

3. **Add CSS for new landing layout** (`Auth.css` or new `Landing.css`)

#### Files to Modify
- `src/client/views/Landing.tsx`
- `src/client/Router.tsx`
- `src/client/views/Auth.css`

---

### Phase 2: Settings Tab Reorganization

**Goal:** Clear sections for Account, Displays, Permissions

#### Tasks

1. **Restructure `SettingsTab.tsx`**
   - Create section components: `SectionAccount`, `SectionDisplays`, `SectionPermissions`, `SectionBoardInfo`
   - Move `SectionStaffAccess` into `SectionPermissions`
   - Move `SectionRedeemInvite` into Account area for non-owners
   - Conditionally show Displays and Permissions sections for owners only

2. **Consolidate TokensTab into Settings**
   - Move token list/create/revoke UI into `SectionPermissions` as "API Tokens (Advanced)"
   - Add collapsible/expandable state for advanced section
   - Remove TokensTab from nav bar

3. **Move Timezone to Displays section**
   - Group timezone selector with display management
   - Rationale: timezone affects how displays show time

4. **Update `ControllerView.tsx`**
   - Remove Tokens tab from navigation
   - Remove `TokensTab` import

#### Files to Modify
- `src/client/views/Controller/SettingsTab.tsx`
- `src/client/views/Controller/SettingsTab.css`
- `src/client/views/ControllerView.tsx`

#### Files to Delete
- `src/client/views/Controller/TokensTab.tsx` (after consolidation)
- `src/client/views/Controller/TokensTab.css`

---

### Phase 3: Board Tab Display Controls

**Goal:** Move display-related controls (Time Mode, Zoom) to Board tab

#### Tasks

1. **Create Display Controls drawer in `BoardTab.tsx`**
   - Add collapsible "Display Controls" section
   - Move Time Mode selector from Settings
   - Move Zoom selector from Settings
   - Only show controls if user has edit permission

2. **Update `BoardTab.css`**
   - Style the display controls drawer
   - Ensure mobile-friendly layout

3. **Remove controls from `SettingsTab.tsx`**
   - Delete Time Mode section
   - Delete Display Zoom section
   - Keep only Account, Displays, Permissions, Board Info

#### Files to Modify
- `src/client/views/Controller/BoardTab.tsx`
- `src/client/views/Controller/BoardTab.css`
- `src/client/views/Controller/SettingsTab.tsx`

---

### Phase 4: Auth Flow Polish

**Goal:** Ensure smooth owner signup → auto-board-creation flow

#### Tasks

1. **Update `SignupView.tsx`**
   - After successful signup, check for existing boards
   - If zero boards, call `createBoard()` automatically
   - Navigate to `/controller`

2. **Update `LoginView.tsx`**
   - After successful login, fetch user's boards
   - If exactly one board, auto-select it
   - Navigate to `/controller`

3. **Add `/api/user/boards` endpoint** (if not exists)
   - Returns list of boards user has access to
   - Used for multi-board support (future)

#### Files to Modify
- `src/client/views/SignupView.tsx`
- `src/client/views/LoginView.tsx`
- `src/server/routes/users.ts` (if endpoint missing)

---

### Phase 5: Test Updates

**Goal:** E2E tests validate new flows

#### Tasks

1. **Update `auth.spec.ts`**
   - Test landing page code entry flow
   - Test owner signup → auto-board-creation
   - Test returning user auto-redirect

2. **Update `stories.spec.ts`**
   - Verify Story A-F assertions
   - Test Settings tab sections visibility by role

3. **Update `controller.spec.ts`**
   - Verify Tokens tab removed from nav
   - Verify display controls in Board tab

#### Files to Modify
- `tests/e2e/auth.spec.ts`
- `tests/e2e/stories.spec.ts`
- `tests/e2e/controller.spec.ts`

---

## Part 6: Component Reference

### Current Components (Auth Branch)

| Component | Location | Purpose |
|-----------|----------|---------|
| `Landing` | `views/Landing.tsx` | Entry point with code entry |
| `LoginView` | `views/LoginView.tsx` | Email/password login |
| `SignupView` | `views/SignupView.tsx` | New user registration |
| `ProvisioningView` | `views/ProvisioningView.tsx` | TV display provisioning |
| `ControllerView` | `views/ControllerView.tsx` | Main controller shell |
| `SettingsTab` | `views/Controller/SettingsTab.tsx` | Settings, needs reorganization |
| `TokensTab` | `views/Controller/TokensTab.tsx` | API tokens, to be consolidated |
| `BoardTab` | `views/Controller/BoardTab.tsx` | TV preview, needs controls |

### Shared Services

| Service | Location | Purpose |
|---------|----------|---------|
| `pairWithCode` | `services/api.ts` | Exchange 6-digit code for access |
| `createBoard` | `services/api.ts` | Create new board |
| `redeemInvite` | `services/api.ts` | Upgrade access with invite code |
| `generateInviteCode` | `services/api.ts` | Generate invite for staff |
| `listDevices` | `services/api.ts` | List linked TV displays |
| `listControllerTokens` | `services/api.ts` | List API tokens |

---

### Phase 6: Cleanup (Greenfield)

**Goal:** Remove legacy code, collapse migrations, eliminate cruft

Since this is a greenfield deployment with no production data, we can be aggressive about cleanup.

#### 6.1 Database Migration Collapse

Collapse 4 migrations into a single `001_schema.sql`:

**Current migrations to merge:**
- `001_initial_schema.sql` - boards, feeds, horses, diet_entries
- `002_authentication.sql` - users, sessions, accounts, verifications, controller_tokens, adds account_id to boards
- `003_add_token_type.sql` - adds `type` column to controller_tokens
- `005_invite_codes.sql` - invite_codes table

**Target:** Single `001_schema.sql` with final schema state

**Tasks:**
1. Create new `001_schema.sql` with complete schema
2. Delete old migration files
3. Update `migrate.ts` if needed (should auto-detect single file)

**Files to Delete:**
- `src/server/db/migrations/001_initial_schema.sql`
- `src/server/db/migrations/002_authentication.sql`
- `src/server/db/migrations/003_add_token_type.sql`
- `src/server/db/migrations/005_invite_codes.sql`

**Files to Create:**
- `src/server/db/migrations/001_schema.sql` (consolidated)

---

#### 6.2 Remove TokensTab

After Phase 2 consolidates tokens into Settings:

**Files to Delete:**
- `src/client/views/Controller/TokensTab.tsx`
- `src/client/views/Controller/TokensTab.css`

**Files to Update:**
- `src/client/views/Controller/index.ts` - remove TokensTab export

---

#### 6.3 Simplify `is_claimed` → `is_owner`

The `is_claimed` concept is legacy from ClaimBoard. Since boards are now auto-created for owners, we only need `is_owner`.

**Current (legacy):**
```typescript
ownership: {
  is_claimed: boolean;  // ← REMOVE
  is_owner: boolean;
  permission: 'none' | 'view' | 'edit' | 'admin';
}
```

**Target:**
```typescript
ownership: {
  is_owner: boolean;
  permission: 'none' | 'view' | 'edit' | 'admin';
}
```

**Files to Update:**
- `src/client/stores/index.ts` - remove `is_claimed` from ownership signal
- `src/client/services/api.ts` - remove `is_claimed` from BootstrapResponse type
- `src/server/routes/bootstrap.ts` - remove `is_claimed` from ownership response

---

#### 6.4 PairingView Removal (Completed)

PairingView was removed as Landing page now handles code entry.

**Changes Made:**
- Deleted `views/PairingView.tsx`
- Updated `Router.tsx` → `GuardedController()` now redirects to `/` when no board stored
- Removed pairing CSS from `layout.css`
- Cleaned up test selectors

---

#### 6.5 Remove Dev/Test Scripts

Scripts that were only for development testing:

**Files to Delete:**
- `scripts/test-auth.ts` - manual auth testing
- `scripts/test-db-direct.ts` - direct DB testing
- `scripts/manual_migrate.ts` - if not needed

**Files to Keep:**
- `scripts/verify-permission-enforcement.ts` - useful for CI/validation

---

#### 6.6 Documentation Cleanup

**Remove deprecated sections:**

`docs/auth/API_SPEC.md`:
- Remove "Board Claim (Deprecated)" section (lines 40-71)

`docs/auth/CLIENT_IMPL.md`:
- Remove any ClaimBoard references

`IMPLEMENTATION_PLAN.md`:
- Remove Phase 8 ClaimBoard deprecation notes (already done)

**Files to Update:**
- `docs/auth/API_SPEC.md`
- `AGENTS.md` - remove ClaimBoard references if any

---

#### 6.7 Unused Imports & Dead Code

Run cleanup pass to remove:

1. **Unused imports** in modified files
2. **Dead CSS** - styles for removed components
3. **Commented-out code** - remove rather than keep

**Tool:** `npx tsc --noEmit` to find unused exports

---

#### 6.8 Cleanup Checklist

| Target | Action | Status |
|--------|--------|--------|
| Migrations | Collapse to single file | [x] |
| TokensTab | Delete after consolidation | [x] |
| `is_claimed` | Remove from ownership | [x] |
| PairingView | Removed (redirect to Landing) | [x] |
| Dev scripts | Delete test-auth.ts, test-db-direct.ts | [x] |
| docs/auth/ | Removed (consolidated into USER_PATHS) | [x] |
| E2E parallel | Fixed with workers: 1 | [x] |

---

## Part 7: Migration Notes

Since this is a **greenfield deployment**, backwards compatibility is not required. We can make breaking changes freely.

### What Changes

1. **Tokens tab removed** - Consolidated into Settings → Permissions
2. **Landing page redesigned** - Code entry is primary action
3. **Settings reorganized** - Time Mode and Zoom moved to Board tab
4. **`is_claimed` removed** - Simplified to just `is_owner`
5. **Migrations collapsed** - Single schema file

### No Rollback Needed

This is greenfield - no production data to migrate. If issues arise, fix forward.
