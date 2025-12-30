# Multi-Tenant Authentication Implementation Plan

This plan evolves HorseBoard from a single-user prototype into a multi-tenant SaaS foundation with accounts, authentication, and access control.

## Product Decisions

| Decision | Choice |
|----------|--------|
| Email verification | Skip for MVP (add later) |
| Password requirements | Better Auth defaults (min 8 chars) |
| Session duration | 30 days (configurable) |
| Deleted account → board | Board becomes unclaimed |
| Controller token prefix | `hb_` |
| Pair code visibility | Anyone can see (view access) |

## Reference Documents

| Document | Contents |
|----------|----------|
| [docs/auth/DATA_MODEL.md](docs/auth/DATA_MODEL.md) | Tables, schema, migration SQL |
| [docs/auth/PERMISSION_MODEL.md](docs/auth/PERMISSION_MODEL.md) | Permission levels, resolution logic, middleware |
| [docs/auth/AUTH_FLOWS.md](docs/auth/AUTH_FLOWS.md) | Signup, login, logout, session handling |
| [docs/auth/API_SPEC.md](docs/auth/API_SPEC.md) | New/modified endpoints, request/response formats |
| [docs/auth/CLIENT_IMPL.md](docs/auth/CLIENT_IMPL.md) | Views, stores, API service updates |
| [docs/auth/TESTING.md](docs/auth/TESTING.md) | Unit, integration, E2E test coverage |
| [docs/auth/EDGE_CASES.md](docs/auth/EDGE_CASES.md) | Error handling, edge case scenarios |

---

## Phase 1: Database Schema & Better Auth Setup [COMPLETED]

**Objective:** Better Auth integrated, tables created, basic auth working

### Tasks

1. Install: `npm install better-auth`
2. Create `src/server/lib/auth-instance.ts` with Better Auth configuration
3. Create migration `002_authentication.sql`
4. Run Better Auth CLI to generate/verify schema
5. Mount Better Auth handler in `server/index.ts`
6. Create basic auth store on client
7. Test signup/signin/signout flows manually

### References

- [DATA_MODEL.md](docs/auth/DATA_MODEL.md) — Schema, migration SQL, Better Auth config
- [AUTH_FLOWS.md](docs/auth/AUTH_FLOWS.md) — Signup/login/logout sequences

### Tests

- Unit: Auth instance configuration exports correctly
- Integration: `POST /api/auth/sign-up/email` creates user
- Integration: `POST /api/auth/sign-in/email` returns session
- Integration: Session cookie is set and validated

### Outcome

Users can sign up and sign in. Sessions are stored. No routes protected yet.

---

## Phase 2: Permission Resolution & Middleware [COMPLETED]

**Objective:** Auth middleware resolves permissions correctly

### Tasks

1. Create `src/server/lib/auth.ts` with `resolveAuth()` and permission types
2. Create `requirePermission()` middleware
3. Add `account_id` column to boards table
4. Create controller tokens table
5. Create controller tokens repository in engine.ts
6. Implement token hashing and validation
7. Update `RouteContext` type to include auth

### References

- [PERMISSION_MODEL.md](docs/auth/PERMISSION_MODEL.md) — Permission levels, resolution logic, middleware code
- [DATA_MODEL.md](docs/auth/DATA_MODEL.md) — controller_tokens table schema

### Tests

- Unit: `resolveAuth` correctly identifies session, token, or unauthenticated
- Unit: `resolvePermissionForBoard` returns correct permission levels
- Unit: Token hashing is consistent
- Integration: Expired tokens are rejected
- Integration: Valid tokens grant correct permission

### Outcome

Permission resolution works for all access methods. Tokens can be created and validated. Middleware ready but not yet applied.

---

## Phase 3: Protect Existing Routes [COMPLETED]

**Objective:** All existing endpoints have appropriate permission checks

### Tasks

1. Apply `requirePermission('view')` to all GET routes
2. Apply `requirePermission('edit')` to all POST/PATCH/PUT/DELETE routes
3. Apply `requirePermission('admin')` to DELETE /api/boards/:id
4. Update bootstrap endpoint to include ownership info
5. Add permission context to SSE handler
6. Test all routes with various auth states

### References

- [API_SPEC.md](docs/auth/API_SPEC.md) — Endpoint permission requirements
- [PERMISSION_MODEL.md](docs/auth/PERMISSION_MODEL.md) — Middleware usage

### Tests

- Integration: Unauthenticated user can read but not write
- Integration: Controller token with 'edit' can write
- Integration: Controller token with 'view' cannot write
- Integration: Owner gets 'admin' permission
- E2E: Protected routes return 403 when unauthorized

### Outcome

All API routes enforce permissions. **Breaking change:** writes require at least 'edit' permission.

---

## Phase 4: Board Claiming Flow [COMPLETED]

**Objective:** Users can claim unclaimed boards

### Tasks

1. Add `POST /api/boards/:id/claim` endpoint
2. Add `GET /api/user/boards` endpoint
3. Create ClaimBoardPrompt component on client
4. Update PairingView to show claim option
5. Update bootstrap response with ownership info
6. Update client permission store on claim

### References

- [API_SPEC.md](docs/auth/API_SPEC.md) — Claim endpoint spec, user boards endpoint
- [AUTH_FLOWS.md](docs/auth/AUTH_FLOWS.md) — New user signup via board claim
- [CLIENT_IMPL.md](docs/auth/CLIENT_IMPL.md) — ClaimBoardPrompt component

### Tests

- Integration: Claim endpoint sets account_id
- Integration: Cannot claim already-claimed board (409)
- Integration: User boards endpoint returns owned boards
- E2E: Pair → signup → claim flow works

### Outcome

New users can claim boards on signup. Returning users see their owned boards. Unclaimed boards still accessible view-only.

---

## Phase 5: Client Auth UI [COMPLETED]

**Objective:** Complete auth UI on client

### Tasks

1. Create LoginView component
2. Create SignupView component
3. Integrate auth client from better-auth/client
4. Add auth state to App.tsx routing
5. Add SignOut button to SettingsTab
6. Show/hide edit controls based on permission
7. Add account info display in settings

### References

- [CLIENT_IMPL.md](docs/auth/CLIENT_IMPL.md) — Views, stores, permission-based UI
- [AUTH_FLOWS.md](docs/auth/AUTH_FLOWS.md) — Client session handling

### Tests

- E2E: Signup flow creates account and logs in
- E2E: Login flow authenticates existing user
- E2E: Logout clears session
- E2E: Edit buttons hidden for view-only users

### Outcome

Full auth UI experience. Users can signup, login, logout. UI reflects permission level.

---

## Phase 6: Controller Token Management [COMPLETED]

**Objective:** Owners can create and manage controller tokens

### Tasks

1. Add TokensTab to Controller
2. Create token creation modal
3. Implement token list display
4. Implement token revocation
5. Show token value only on creation (copy to clipboard)
6. Add token input flow for staff connecting with token

### References

- [API_SPEC.md](docs/auth/API_SPEC.md) — Token endpoints
- [CLIENT_IMPL.md](docs/auth/CLIENT_IMPL.md) — TokensTab component, API service methods
- [PERMISSION_MODEL.md](docs/auth/PERMISSION_MODEL.md) — Token permission levels

### Tests

- Integration: Create token returns token value
- Integration: List tokens does not include token value
- Integration: Revoke token deletes from database
- E2E: Owner can create, list, revoke tokens
- E2E: Staff can connect with token and has correct permissions

### Outcome

Complete token management UI. Staff can use tokens to access boards. Multi-device access pattern works.

---

## Phase 7: Polish & Edge Cases [COMPLETED]

**Objective:** Production-ready auth system

### Tasks

1. Handle session expiry gracefully
2. Handle token revocation during active use
3. Add loading states for auth operations
4. Add error messages for auth failures
5. Token expiry checking and cleanup
6. Rate limiting on auth endpoints (via Better Auth config)
7. Audit all error responses

### References

- [EDGE_CASES.md](docs/auth/EDGE_CASES.md) — All edge case scenarios and handling
- [TESTING.md](docs/auth/TESTING.md) — Edge case test coverage

### Tests

- E2E: Expired session redirects to login
- E2E: Revoked token shows error, prompts re-auth
- E2E: Network failures show retry option

### Outcome

Production-ready auth system. All edge cases handled gracefully.

---

## Phase 8: TV Persistence & Provisioning Flow [COMPLETED]

**Objective:** Implementation of Device Provisioning Model (TVs as dumb displays linked to a board).

### Tasks

1. **Database:**
   - Create migration `003_add_token_type.sql`.
   - Add `type` column to `controller_tokens` table (values: 'controller', 'display').
   - Handle SQLite check constraint updates (recreate table strategy).

2. **API Updates:**
   - Deprecate/Remove `CLAIM` endpoints context.
   - Implement `POST /api/devices/link` (Exchange Provisioning Code for Token).
   - Implement `GET /api/devices` (List active displays).
   - Implement `DELETE /api/devices/:id` (Revoke display access).

3. **TV Client (Display):**
   - Implement "Unprovisioned" state UI (shows Provisioning Code).
   - Implement polling mechanism to check for token assignment.
   - Persist Device Token in `localStorage`.
   - Remove "Auto-Create Board" logic.

4. **Controller Client (Mobile/Web):**
   - Add "Displays" section in Settings.
   - Implement "Add Display" modal (Input Provisioning Code).
   - Visualize linked displays.

### References

- [DATA_MODEL.md](docs/auth/DATA_MODEL.md) — New token type schema.
- [AUTH_FLOWS.md](docs/auth/AUTH_FLOWS.md) — Device provisioning sequence.
- [API_SPEC.md](docs/auth/API_SPEC.md) — Device link endpoints.

### Tests

- Integration: Linking valid code creates 'display' token.
- E2E: TV shows code -> Controller inputs code -> TV receives token -> TV loads board.
- Integration: Revoking display token forces TV back to "Unprovisioned".

### Outcome

TVs are persistent devices managed by the Controller. "Claiming" flow is retired.

---

## Summary

| Phase | Objective | Key Deliverable | Status |
|-------|-----------|-----------------|--------|
| 1 | Better Auth setup | Users can sign up/in | Done |
| 2 | Permission middleware | Auth resolution works | Done |
| 3 | Protect routes | API enforces permissions | Done |
| 4 | Board claiming | Users own boards | Done |
| 5 | Client auth UI | Full auth experience | Done |
| 6 | Token management | Multi-device access | Done |
| 7 | Polish | Production-ready | Done |
| 8 | TV Persistence | Device Provisioning Model | Done |

Each phase produces a working application. All phases can be completed independently with incremental, testable progress.
