# Edge Cases and Error Handling

## Claiming Already-Claimed Board

**Scenario:** User pairs with board, goes to claim, but another user claims it first.

**Handling:**
1. `POST /api/boards/:id/claim` checks `account_id IS NULL` before update
2. If already claimed, return 409 Conflict
3. Client shows: "This board already has an owner. You can view but not edit."
4. Client updates local permission to 'view'

## Token Revocation During Active Use

**Scenario:** Owner revokes a token while staff member is actively using it.

**Handling:**
1. Token validated on every request (no caching)
2. Next API call with revoked token returns 401
3. Client detects 401, clears stored token
4. Client shows: "Your access has been revoked. Please contact the board owner."
5. Client falls back to view-only mode

## Session Expiry

**Scenario:** User's session expires while they have the app open.

**Handling:**
1. Better Auth sessions have configurable TTL (30 days)
2. API calls with expired session return 401
3. Client detects 401, clears user state
4. Client shows login prompt: "Session expired. Please sign in again."
5. SSE connection closes; reconnect shows current (anonymous) state

## Invalid or Malformed Tokens

**Scenario:** Request has Authorization header with invalid format or nonexistent token.

**Handling:**
- Token doesn't start with `hb_` → Ignore, try session auth
- Token hash not in database → Return 401 "Invalid token"
- Token expired → Return 401 "Token expired"
- Malformed header → Return 400 "Invalid Authorization header"

## Permission Denied

**Scenario:** User/token attempts action beyond their permission level.

**Handling:**
1. Return 403 Forbidden: "Insufficient permissions"
2. Include required permission in response: `{ "required": "edit", "current": "view" }`
3. Client shows appropriate message
4. Log the attempt for security monitoring

## Network Failures During Auth Flows

### Signup/Login Failure
1. Show error message with retry option
2. Don't clear partial state
3. Allow user to try again

### Claim Failure After Signup
1. User is logged in, claim failed
2. Show error, allow retry
3. Offer to continue without claiming (view-only)

### Token Creation Failure
1. Show error, allow retry
2. Token not created, nothing to clean up

## Concurrent Sessions/Tokens

### Multiple Sessions for Same User
- Better Auth supports by default
- Each device has its own session
- All sessions valid until individually expired/revoked

### Multiple Tokens for Same Board
- Fully supported
- Each token tracked independently
- Revocation affects only that token
