# Technical Specification: HorseBoard

## 1. System Purpose

The system synchronizes horse feeding schedules between a mobile controller and a stable TV board in real-time.

**Core experience:** Edit feeding quantities on a mobile device; observe changes instantly on the stable TV.

**Domain model:** A board represents a stable's feed management instance. The board renders a grid where columns represent horses, rows represent feeds, and cells contain quantity values shown as AM or PM amounts.

**Scoping:** Each board represents one stable. All horses, feeds, and diet entries belong exclusively to their parent board. Creating a new board provisions an isolated data set with no shared state.

**Future direction:** The system will support accounts and authentication. Boards will belong to accounts, and controller tokens will manage access permissions to boards. These features are planned but not yet implemented.

---

## 2. Architecture

### 2.1 Component Overview

The system comprises three components:

- **TV Board:** A passive renderer that subscribes to server events and displays the current state. It does not initiate edits.
- **Mobile Controller:** A Progressive Web App that serves as the sole interface for data modification. All create, update, and delete operations originate here.
- **Backend Server:** The single source of truth. It persists data in SQLite, enforces business rules, and broadcasts state changes via Server-Sent Events.

### 2.2 Server Architecture

**Route Organization:** Routes are organized as explicit per-resource files. Each resource (boards, horses, feeds, diet) has its own route module that handles CRUD operations for that resource type.

**Repository Pattern:** The server uses repository classes that provide data access methods. Repositories handle database interactions and return typed objects.

### 2.3 Client Architecture

**Centralized API Service:** The client uses a centralized API service (`src/client/services/api.ts`) that encapsulates all HTTP communication with the server. Components do not make direct fetch calls; they use the API service.

**Store Pattern:** Stores use a generic collection pattern with Preact Signals for reactivity. Each resource type has a store created by a factory function that provides:
- Map-based storage for O(1) lookups
- Reconciliation logic to handle SSE vs API conflicts
- Version-based reactivity to minimize re-renders

### 2.4 Shared Kernel Pattern

The `src/shared/` directory contains business logic that executes identically on both client and server:

| Module | Purpose |
|--------|---------|
| `resources.ts` | Zod validation schemas, resource configuration |
| `time-mode.ts` | Time mode calculation (AUTO/AM/PM resolution) |
| `fractions.ts` | Quantity formatting with Unicode fraction characters |

This pattern prevents logic drift by ensuring the same validation schemas and calculation functions run in both environments.

### 2.5 Data Flow

```
Controller → REST API → SQLite → SSE Broadcast → TV Board
                ↓
         Shared Kernel
         (validation, time mode, fractions)
```

---

## 3. Data Dictionary

All column names use snake_case. TypeScript types mirror database column names exactly.

### 3.1 Board

Represents a stable instance with board settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier (UUID format) |
| `pair_code` | TEXT | UNIQUE NOT NULL | Six-digit pairing code |
| `timezone` | TEXT | NOT NULL, default 'UTC' | IANA timezone string |
| `time_mode` | TEXT | CHECK IN ('AUTO','AM','PM'), default 'AUTO' | Current mode setting |
| `override_until` | TEXT | nullable | ISO timestamp when manual override expires |
| `zoom_level` | INTEGER | CHECK 1-3, default 2 | Horses per page (1=10, 2=7, 3=5) |
| `current_page` | INTEGER | default 0 | Zero-indexed page position |
| `created_at` | TEXT | NOT NULL | Creation timestamp |
| `updated_at` | TEXT | NOT NULL | Last modification timestamp |

**Cascade behavior:** Deleting a board cascades to all horses, feeds, and diet entries via foreign key constraints.

### 3.2 Horse

Represents a horse belonging to a board.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier |
| `board_id` | TEXT | REFERENCES boards(id) ON DELETE CASCADE | Parent board |
| `name` | TEXT | NOT NULL, 1-50 chars | Horse name (unique within board) |
| `note` | TEXT | max 200 chars, nullable | Temporary note |
| `note_expiry` | TEXT | nullable | ISO timestamp when note auto-clears |
| `archived` | INTEGER | default 0 | Archive flag (0=active, 1=archived) |
| `created_at` | TEXT | NOT NULL | Creation timestamp |
| `updated_at` | TEXT | NOT NULL | Last modification timestamp |

**Uniqueness:** The combination `(board_id, name)` is unique.

**Cascade behavior:** Deleting a horse cascades to all associated diet entries.

### 3.3 Feed

Represents a feed type belonging to a board.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier |
| `board_id` | TEXT | REFERENCES boards(id) ON DELETE CASCADE | Parent board |
| `name` | TEXT | NOT NULL, 1-50 chars | Feed name (unique within board) |
| `unit` | TEXT | CHECK IN ('scoop','ml','sachet','biscuit') | Measurement unit |
| `rank` | INTEGER | default 0 | Usage-based sort order (higher = more used) |
| `stock_level` | REAL | default 0 | Current inventory level |
| `low_stock_threshold` | REAL | default 0 | Alert threshold |
| `created_at` | TEXT | NOT NULL | Creation timestamp |
| `updated_at` | TEXT | NOT NULL | Last modification timestamp |

**Uniqueness:** The combination `(board_id, name)` is unique.

**Cascade behavior:** Deleting a feed cascades to all associated diet entries.

### 3.4 Diet Entry

Links a horse to a feed with quantity values.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `horse_id` | TEXT | PRIMARY KEY, REFERENCES horses(id) ON DELETE CASCADE | Horse reference |
| `feed_id` | TEXT | PRIMARY KEY, REFERENCES feeds(id) ON DELETE CASCADE | Feed reference |
| `am_amount` | REAL | nullable | Morning quantity |
| `pm_amount` | REAL | nullable | Evening quantity |
| `created_at` | TEXT | NOT NULL | Creation timestamp |
| `updated_at` | TEXT | NOT NULL | Last modification timestamp |

**Composite primary key:** `(horse_id, feed_id)`.

**Value semantics:**
- `null`: Feed not assigned to this horse for this time slot
- `0`: Horse explicitly receives none of this feed
- Both null and zero render as blank cells

---

## 4. Behavioral Rules

### 4.1 Auto Time Mode

The board shows either AM or PM values based on the effective time mode.

**Calculation (from `src/shared/time-mode.ts`):**

1. If `time_mode` is AM or PM and `override_until` has not passed, use the configured mode
2. Otherwise, determine mode from the current hour in the board's timezone:
   - Hours 4 through 11 (04:00–11:59) → **AM**
   - Hours 12 through 23 and 0 through 3 (12:00–03:59) → **PM**

**Override expiry:**
- Setting time mode to AM or PM sets `override_until` to 1 hour from the current time
- Setting time mode to AUTO clears `override_until`
- The server checks for expired overrides and reverts expired boards to AUTO

### 4.2 Feed Ranking

Feeds are ranked by usage to optimize board order.

**Algorithm:**

```sql
SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count
FROM feeds f
LEFT JOIN diet_entries d ON f.id = d.feed_id
  AND (d.am_amount > 0 OR d.pm_amount > 0)
WHERE f.board_id = ?
GROUP BY f.id
ORDER BY usage_count DESC
```

Feeds receive rank values in descending order of usage count. A feed assigned to more horses receives a higher rank number. The feed list orders by `rank DESC, name ASC`.

**Trigger:** Ranking recalculates automatically when diet entries change.

### 4.3 Quantity Formatting

Quantities render with Unicode fraction characters when possible.

**Fraction map (from `src/shared/fractions.ts`):**

| Decimal | Character |
|---------|-----------|
| 0.25 | ¼ |
| 0.33 | ⅓ |
| 0.5 | ½ |
| 0.67 | ⅔ |
| 0.75 | ¾ |

**Rules:**
- Whole numbers with fractional remainders combine (e.g., 1.5 → "1½")
- Values that don't match known fractions display as decimals
- Zero and null values render as blank (empty string)

### 4.4 Note Expiry

Horse notes can auto-clear after a specified time.

**Behavior:**
- The server checks for expired notes periodically
- When `note_expiry` passes, both `note` and `note_expiry` are set to NULL
- Changes broadcast to connected clients

---

## 5. API Contracts

### 5.1 Resource Endpoints

**Board-scoped resources (horses, feeds):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/boards/:board_id/horses` | List horses for board |
| POST | `/api/boards/:board_id/horses` | Create horse |
| GET | `/api/horses/:id` | Get horse by ID |
| PATCH | `/api/horses/:id` | Update horse |
| DELETE | `/api/horses/:id` | Delete horse |

**Diet entries:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/diet?board_id=xxx` | List diet entries for board |
| PUT | `/api/diet` | Upsert diet entry |
| DELETE | `/api/diet/:horse_id/:feed_id` | Delete diet entry |

**Boards:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/boards/:id` | Get board settings |
| POST | `/api/boards` | Create new board |
| PATCH | `/api/boards/:id` | Update board settings |
| PUT | `/api/boards/:id/time-mode` | Set time mode with override |

### 5.2 Special Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bootstrap/:board_id` | Full state for client hydration |
| GET | `/api/bootstrap/pair/:code` | Pair by code, returns full state |
| POST | `/api/boards/:board_id/feeds/recalculate-rankings` | Trigger manual ranking recalculation |

### 5.3 Request/Response Format

All API requests and responses use snake_case field names.

**Create horse request:**

```json
{
  "name": "Thunder",
  "note": "New arrival",
  "note_expiry": "2024-01-20T12:00:00.000Z"
}
```

**Horse response:**

```json
{
  "id": "h_abc123",
  "board_id": "b_xyz789",
  "name": "Thunder",
  "note": "New arrival",
  "note_expiry": "2024-01-20T12:00:00.000Z",
  "archived": false,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Diet entry upsert:**

```json
{
  "horse_id": "h_abc123",
  "feed_id": "f_def456",
  "am_amount": 1.5,
  "pm_amount": 2.0
}
```

**Board settings update:**

```json
{
  "timezone": "Australia/Sydney",
  "zoom_level": 2,
  "current_page": 0
}
```

### 5.4 Server-Sent Events

**Endpoint:** `GET /api/boards/:board_id/events`

**Connection lifecycle:**
1. Client opens EventSource connection
2. Server sends initial `full` event with complete state
3. Server sends keepalive comments every 30 seconds
4. Server broadcasts updates when data changes

**Event format:**

```json
{
  "type": "full",
  "data": {
    "board": {
      "id": "b_xyz789",
      "pair_code": "123456",
      "timezone": "UTC",
      "time_mode": "AUTO",
      "override_until": null,
      "zoom_level": 2,
      "current_page": 0,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    "horses": [],
    "feeds": [],
    "diet_entries": []
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Client reconnection:** The SSE client implements exponential backoff (1s, 2s, 4s, 8s, 16s) with a maximum of 5 attempts.

---

## 6. Client State Management

The client uses Preact Signals for reactive state management. Store factories create specialized stores for each resource type.

### 6.1 Store Types

| Store | Factory | Key Properties |
|-------|---------|----------------|
| Board | `createBoardStore()` | `board`, `effective_time_mode`, `timezone` |
| Horses | `createHorseStore()` | `items`, `by_id`, `filtered`, `active` |
| Feeds | `createFeedStore()` | `items`, `by_id`, `by_rank` |
| Diet | `createDietStore()` | `items`, `by_key`, `by_horse`, `by_feed` |

### 6.2 Store Interface

Each store implements a common interface:

```typescript
interface ResourceStore<T> {
  items: ReadonlySignal<T[]>;
  by_id: ReadonlySignal<Map<string, T>>;
  version: Signal<number>;
  set(items: T[], source?: UpdateSource);
  add(item: T, source?: UpdateSource);
  update(id: string, updates: Partial<T>, source?: UpdateSource);
  upsert(item: T, source?: UpdateSource);
  remove(id: string, source?: UpdateSource);
  get(id: string);
  reconcile(incoming_items: T[], source: UpdateSource);
}
```

### 6.3 Shared Kernel Integration

The board store imports `getEffectiveTimeMode` from `@shared/time-mode` to compute the effective time mode reactively. This ensures the client displays the same time mode the server calculates.

---

## 7. Scheduled Tasks

The server runs background tasks:

| Task | Description |
|------|-------------|
| Override expiry check | Reverts expired time mode overrides to AUTO |
| Note expiry check | Clears expired horse notes |
| SSE keepalive | Sends comment every 30 seconds to prevent connection timeout |

---

## 8. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `DB_PATH` | `./data/horseboard.db` | SQLite database file path |

The database uses WAL mode for improved concurrency and enforces foreign key constraints.

---

## 9. Future Additions

The following features are planned but not yet implemented:

- **Accounts:** User accounts will own boards and provide identity management
- **Authentication:** Login/logout flows and session management
- **Controller tokens:** Access tokens that grant specific permissions to boards, allowing secure sharing without full account access
