# Technical Specification: HorseBoard

## 1. System Purpose

The system synchronizes horse feeding schedules between a mobile controller and a stable TV display in real-time.

**Core experience:** Edit feeding quantities on a mobile device; observe changes instantly on the stable TV.

**Domain model:** The display renders a grid where columns represent horses, rows represent feeds, and cells contain quantity values shown as AM or PM amounts.

**Scoping:** Each display represents one stable. All horses, feeds, and diet entries belong exclusively to their parent display. Creating a new display provisions an isolated data set with no shared state.

---

## 2. Architecture

### 2.1 Component Overview

The system comprises three components:

- **TV Display:** A passive renderer that subscribes to server events and displays the current state. It does not initiate edits.
- **Mobile Controller:** A Progressive Web App that serves as the sole interface for data modification. All create, update, and delete operations originate here.
- **Backend Server:** The single source of truth. It persists data in SQLite, enforces business rules, and broadcasts state changes via Server-Sent Events.

### 2.2 Shared Kernel Pattern

The `src/shared/` directory contains business logic that executes identically on both client and server:

| Module | Purpose |
|--------|---------|
| `resources.ts` | Zod validation schemas, resource configuration, column mappings |
| `time-mode.ts` | Time mode calculation (AUTO/AM/PM resolution) |
| `fractions.ts` | Quantity formatting with Unicode fraction characters |

This pattern prevents logic drift by ensuring the same validation schemas and calculation functions run in both environments. The client imports these modules directly; the server uses them through the engine layer.

### 2.3 Data Flow

```
Controller → REST API → SQLite → SSE Broadcast → TV Display
                ↓
         Shared Kernel
         (validation, time mode, fractions)
```

The client maintains local stores using Preact Signals. These stores expose reactive properties that components consume directly. The SSE client hydrates these stores on connection and updates them when events arrive.

---

## 3. Data Dictionary

### 3.1 Display

Represents a stable instance with display settings.

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

**Cascade behavior:** Deleting a display cascades to all horses, feeds, and diet entries via foreign key constraints.

### 3.2 Horse

Represents a horse belonging to a display.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier |
| `display_id` | TEXT | REFERENCES displays(id) ON DELETE CASCADE | Parent display |
| `name` | TEXT | NOT NULL, 1-50 chars | Horse name (unique within display) |
| `note` | TEXT | max 200 chars, nullable | Temporary note |
| `note_expiry` | TEXT | nullable | ISO timestamp when note auto-clears |
| `archived` | INTEGER | default 0 | Archive flag (0=active, 1=archived) |
| `created_at` | TEXT | NOT NULL | Creation timestamp |
| `updated_at` | TEXT | NOT NULL | Last modification timestamp |

**Uniqueness:** The combination `(display_id, name)` is unique.

**Cascade behavior:** Deleting a horse cascades to all associated diet entries.

### 3.3 Feed

Represents a feed type belonging to a display.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier |
| `display_id` | TEXT | REFERENCES displays(id) ON DELETE CASCADE | Parent display |
| `name` | TEXT | NOT NULL, 1-50 chars | Feed name (unique within display) |
| `unit` | TEXT | CHECK IN ('scoop','ml','sachet','biscuit') | Measurement unit |
| `rank` | INTEGER | default 0 | Usage-based sort order (higher = more used) |
| `stock_level` | REAL | default 0 | Current inventory level |
| `low_stock_threshold` | REAL | default 0 | Alert threshold |
| `created_at` | TEXT | NOT NULL | Creation timestamp |
| `updated_at` | TEXT | NOT NULL | Last modification timestamp |

**Uniqueness:** The combination `(display_id, name)` is unique.

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

The display shows either AM or PM values based on the effective time mode.

**Calculation (from `src/shared/time-mode.ts`):**

1. If `time_mode` is AM or PM and `override_until` has not passed, use the configured mode
2. Otherwise, determine mode from the current hour in the display's timezone:
   - Hours 4 through 11 (04:00–11:59) → **AM**
   - Hours 12 through 23 and 0 through 3 (12:00–03:59) → **PM**

**Override expiry:**
- Setting time mode to AM or PM sets `override_until` to 1 hour from the current time
- Setting time mode to AUTO clears `override_until`
- The server checks for expired overrides every 60 seconds and reverts expired displays to AUTO

### 4.2 Feed Ranking

Feeds are ranked by usage to optimize display order.

**Algorithm (from `src/server/lib/engine.js`):**

```sql
SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count
FROM feeds f
LEFT JOIN diet_entries d ON f.id = d.feed_id
  AND (d.am_amount > 0 OR d.pm_amount > 0)
WHERE f.display_id = ?
GROUP BY f.id
ORDER BY usage_count DESC
```

Feeds receive rank values in descending order of usage count. A feed assigned to more horses receives a higher rank number. The feed list orders by `rank DESC, name ASC`.

**Trigger:** Ranking recalculates automatically when diet entries change (via the `onWrite` hook on the diet resource).

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
- The server checks for expired notes every hour (3600000ms)
- When `note_expiry` passes, both `note` and `note_expiry` are set to NULL
- Changes broadcast to connected clients

---

## 5. API Contracts

### 5.1 Resource Endpoints

The server generates REST endpoints from the `RESOURCES` configuration using the `mountResource()` function.

**Display-scoped resources (horses, feeds):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/displays/:displayId/horses` | List horses for display |
| POST | `/api/displays/:displayId/horses` | Create horse |
| GET | `/api/horses/:id` | Get horse by ID |
| PATCH | `/api/horses/:id` | Update horse |
| DELETE | `/api/horses/:id` | Delete horse |

**Diet entries:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/diet?displayId=xxx` | List diet entries for display |
| PUT | `/api/diet` | Upsert diet entry |
| DELETE | `/api/diet/:horseId/:feedId` | Delete diet entry |

**Displays:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/displays/:id` | Get display settings |
| POST | `/api/displays` | Create new display |
| PATCH | `/api/displays/:id` | Update display settings |
| PUT | `/api/displays/:id/time-mode` | Set time mode with override |

### 5.2 Special Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bootstrap/:displayId` | Full state for client hydration |
| GET | `/api/bootstrap/pair/:code` | Pair by code, returns full state |
| POST | `/api/displays/:displayId/feeds/recalculate-rankings` | Trigger manual ranking recalculation |

### 5.3 Server-Sent Events

**Endpoint:** `GET /api/displays/:displayId/events`

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
    "display": {...},
    "horses": [...],
    "feeds": [...],
    "diet": [...]
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Client reconnection:** The SSE client implements exponential backoff (1s, 2s, 4s, 8s, 16s) with a maximum of 5 attempts.

---

## 6. Client State Management

The client uses Preact Signals for reactive state management. Store factories in `src/client/lib/engine.ts` create specialized stores for each resource type.

### 6.1 Store Types

| Store | Source Factory | Key Properties |
|-------|----------------|----------------|
| Display | `createDisplayStore()` | `display`, `effectiveTimeMode`, `timezone` |
| Horses | `createHorseStore()` | `items`, `byId`, `filtered`, `active` |
| Feeds | `createFeedStore()` | `items`, `byId`, `byRank` |
| Diet | `createDietStore()` | `items`, `byKey`, `byHorse`, `byFeed` |

### 6.2 Shared Kernel Integration

The display store imports `getEffectiveTimeMode` from `@shared/time-mode` to compute the effective time mode reactively:

```typescript
const effectiveTimeMode = computed<'AM' | 'PM'>(() => {
  return getEffectiveTimeMode(
    configuredMode.value,
    overrideUntil.value,
    timezone.value
  );
});
```

This ensures the client displays the same time mode the server calculates.

---

## 7. Scheduled Tasks

The server runs background tasks at fixed intervals:

| Interval | Task | Description |
|----------|------|-------------|
| 60 seconds | Override expiry check | Reverts expired time mode overrides to AUTO |
| 1 hour | Note expiry check | Clears expired horse notes |
| 30 seconds | SSE keepalive | Sends comment to prevent connection timeout |

---

## 8. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `DB_PATH` | `./data/horseboard.db` | SQLite database file path |

The database uses WAL mode for improved concurrency and enforces foreign key constraints.
