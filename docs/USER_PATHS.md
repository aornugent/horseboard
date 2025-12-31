# User Paths & Critical Assertions

This document serves as the source of truth for the multi-tenant architecture refactor. It defines the specific paths users take and the assertions that must be met for each scenario.

## Story A: The Owner

**Scenario:** A new Barn Manager signs up and immediately manages their stable.

### User Path

1. **User visits `/` on phone** -> Clicks "Get Started".
2. **Signs Up** (Name/Email/Pass).
3. **System:** Detects user has 0 boards -> Auto-creates board "My Stable" -> Redirects to `/controller`.
4. **User lands on Horses Tab** (Empty State).

### Critical Assertions

- [ ] User has **admin** permission.
- [ ] Board `account_id` matches User ID.
- [ ] No "Pairing View" is shown; they go straight to the app.

## Story B: The "Dumb" TV (Hardware Provisioning)

**Scenario:** Linking a new TV to the stable.

### User Path

1. **TV:** Opens `/board`. Checks `localStorage` (empty). Displays giant code `99-AA-BB`. Polls `/api/devices/poll`.
2. **Owner (Phone):** Settings -> Displays -> "Link Display". Enters `99-AA-BB`.
3. **System:** Validates code -> Generates display token -> Links to Owner's Board.
4. **TV:** Poll returns `{ token: "hb_..." }`. TV saves token -> Reloads.

### Critical Assertions

- [ ] TV now renders the Grid View.
- [ ] TV has **view** permission.
- [ ] TV persists token across reloads.

## Story C: Remote Control Mode

**Scenario:** A groom wants to see notes and control the TV pages without an account.

### User Path

1. **Context:** TV is running. Header shows permanent Pair Code (e.g., `123-456`).
2. **Phone:** Visitor loads `/`. Clicks "Connect to Board". Enters `123-456`.
3. **System:** Returns **view** token.
4. **Phone:** Loads Controller UI.

### Critical Assertions

- [ ] "Add Horse" / "Add Feed" buttons are **HIDDEN**.
- [ ] Clicking a Horse shows details (Read Only).
- [ ] **Crucial:** Pagination controls (Next/Prev Page) ARE VISIBLE and functional (User can drive the TV).

## Story D: Generating Invites (Owner)

**Scenario:** Owner needs to give staff Edit access.

### User Path

1. **Owner** goes to Settings -> Staff Access -> "Generate Invite Code".
2. **System** returns short code `555-888` (Valid 15 mins).

### Critical Assertions

- [ ] Only **Admins** can generate this.
- [ ] Code is **distinct** from the permanent Board Pair Code.

## Story E: Redeeming Invites

**Scenario:** A user (who might already be a Visitor) enters an Invite Code to get Edit access.

### User Path

1. **User** (currently View Only) clicks "Enter Invite Code".
2. **Inputs** `555-888`.
3. **System:** Exchanges code for permanent **edit** token.
4. **Client:** Overwrites `hb_view_token` in `localStorage` with `hb_edit_token`. Triggers full reload.

### Critical Assertions

- [ ] App does not crash during token swap.
- [ ] "Add Horse" buttons appear immediately after reload.
- [ ] Old View token is abandoned (orphaned).
