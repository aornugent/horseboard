# API Specifications

## New Endpoints

### Better Auth (auto-mounted)

| Method | Path | Description |
|--------|------|-------------|
| ALL | `/api/auth/*` | Signup, signin, signout, session |

### User Endpoints

#### GET /api/user/boards

List boards owned by authenticated user.

**Requires:** Authenticated session

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "b_xxx",
      "pair_code": "123456",
      "timezone": "Australia/Sydney",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### GET /api/user/profile

Get current user profile.

**Requires:** Authenticated session

### Board Claim (Deprecated)

#### POST /api/boards/:id/claim

**Status:** Deprecated. Use Device Provisioning flow.

Claim an unclaimed board.

**Requires:** Authenticated session

**Request:** (empty body)

**Response (success):**
```json
{
  "success": true,
  "data": {
    "id": "b_xxx",
    "account_id": "user_xxx",
    "pair_code": "123456"
  }
}
```

**Response (already claimed):**
```json
{
  "success": false,
  "error": "Board already has an owner"
}
```
Status: 409 Conflict

Status: 409 Conflict

### Device Management (New)

#### POST /api/devices/link

Exchange a provisioning code for a device token. Links a TV to the user's board.

**Requires:** Authenticated session (Owner)

**Request:**
```json
{
  "code": "8X2-9P",
  "name": "Living Room TV"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device_token": "hb_..."
  }
}
```

#### GET /api/devices

List active displays for the current board.

**Requires:** Authenticated session (Owner)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ct_123",
      "name": "Living Room TV",
      "type": "display",
      "last_used_at": "2024-01-20T08:30:00.000Z",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### DELETE /api/devices/:id

Revoke a display device.

**Requires:** Authenticated session (Owner)

**Response:**
```json
{
  "success": true
}
```

### Controller Token Endpoints

#### POST /api/boards/:id/tokens

Create new controller token.

**Requires:** Admin permission on board

**Request:**
```json
{
  "name": "Barn Manager Phone",
  "permission": "edit",
  "expires_at": "2025-12-31T23:59:59.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ct_xxx",
    "name": "Barn Manager Phone",
    "permission": "edit",
    "token": "hb_a1b2c3d4e5f6..."
  }
}
```

Note: Token value only returned on creation.

#### GET /api/boards/:id/tokens

List tokens for board.

**Requires:** Admin permission on board

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ct_xxx",
      "name": "Barn Manager Phone",
      "permission": "edit",
      "last_used_at": "2024-01-20T08:30:00.000Z",
      "expires_at": null,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### DELETE /api/tokens/:id

Revoke a controller token.

**Requires:** Admin permission on token's board

**Response:**
```json
{
  "success": true
}
```

## Modified Endpoints

### Write Endpoints (require edit permission)

| Endpoint | Required Permission |
|----------|-------------------|
| POST /api/boards/:boardId/horses | edit |
| PATCH /api/horses/:id | edit |
| DELETE /api/horses/:id | edit |
| POST /api/boards/:boardId/feeds | edit |
| PATCH /api/feeds/:id | edit |
| DELETE /api/feeds/:id | edit |
| PUT /api/diet | edit |
| DELETE /api/diet/:horse_id/:feed_id | edit |
| PATCH /api/boards/:id | edit |
| PUT /api/boards/:id/time-mode | edit |
| DELETE /api/boards/:id | admin |

### Read Endpoints (require view permission)

| Endpoint | Required Permission |
|----------|-------------------|
| GET /api/boards/:id | view |
| GET /api/boards/:boardId/horses | view |
| GET /api/horses/:id | view |
| GET /api/boards/:boardId/feeds | view |
| GET /api/feeds/:id | view |
| GET /api/diet | view |
| GET /api/bootstrap/:boardId | view |
| GET /api/boards/:boardId/events (SSE) | view |

### Bootstrap Endpoint Change

`GET /api/bootstrap/:boardId` now includes ownership info:

```json
{
  "success": true,
  "data": {
    "board": { ... },
    "horses": [ ... ],
    "feeds": [ ... ],
    "diet_entries": [ ... ],
    "ownership": {
      "is_claimed": true,
      "is_owner": false,
      "permission": "view"
    }
  }
}
```

## Error Responses

### 401 Unauthorized

No valid auth when required:

```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 403 Forbidden

Authenticated but insufficient permission:

```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

### 409 Conflict

Claim already-claimed board:

```json
{
  "success": false,
  "error": "Board already has an owner"
}
```
