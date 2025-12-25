# Technical Specification: Horse Feed Management System (V3)

## 1. Overview

HorseBoard is a feed management system for equine care. It displays feeding schedules on a stable TV and allows editing via a mobile controller (PWA).

**Core experience:** Update feeding quantities on your phone, see them instantly on the stable TV.

**Domain Model:**
- **Columns** = Horses
- **Rows** = Feeds/Supplements
- **Cells** = Quantities (AM/PM values with units)

**Scoping:** One display = one stable. All horses, feeds, and diets belong to that display. Creating a new display starts a fresh stable with no shared data.

## 2. System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile Web    │────▶│     Backend     │◀────│    TV Web App   │
│  (Vite+Preact)  │     │  (Node/Express) │ SSE │  (Vite+Preact)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Controller              API + SSE              Display
         │                       │                      │
         └───────────┬───────────┘                      │
                     ▼                                  │
              ┌─────────────┐                           │
              │ src/shared/ │◀──────────────────────────┘
              │ Zod Schemas │
              │ Time Logic  │
              │ Formatting  │
              └─────────────┘
```

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend | Node.js + Express | API, SSE, SQLite (3NF), business logic |
| TV Display | Vite + Preact + Signals | Renders feed grid, listens for updates |
| Mobile Controller | Vite + Preact + Signals (PWA) | Pairing, editing, display control |
| Shared | TypeScript + Zod | Schemas, validation, utilities |

**Design principles:**
- TV is a "dumb renderer" - receives state, renders it
- Controller is the "command center" - all editing happens here
- Server owns business logic - ranking, time mode, note expiry
- Shared code prevents client/server drift

## 3. Data Architecture

### 3.1 Database Schema

**SQLite Database:** `./data/horseboard.db`

All tables include `created_at` and `updated_at` timestamps for future audit/history features.

```sql
-- Display represents a stable instance
CREATE TABLE displays (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  time_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (time_mode IN ('AUTO', 'AM', 'PM')),
  override_until TEXT,  -- ISO 8601 timestamp
  zoom_level INTEGER NOT NULL DEFAULT 2 CHECK (zoom_level BETWEEN 1 AND 3),
  current_page INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feeds belong to a display
CREATE TABLE feeds (
  id TEXT PRIMARY KEY,  -- UUID
  display_id TEXT NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('scoop', 'ml', 'sachet', 'biscuit')),
  rank INTEGER NOT NULL DEFAULT 0,
  stock_level REAL NOT NULL DEFAULT 0,         -- Future: inventory tracking
  low_stock_threshold REAL NOT NULL DEFAULT 0, -- Future: low stock alerts
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(display_id, name)
);

-- Horses belong to a display
CREATE TABLE horses (
  id TEXT PRIMARY KEY,  -- UUID
  display_id TEXT NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  note_expiry TEXT,     -- ISO 8601 timestamp
  archived INTEGER NOT NULL DEFAULT 0,  -- Future: history feature (0=active, 1=archived)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(display_id, name)
);

-- Diet entries link horses to feeds with quantities
CREATE TABLE diet_entries (
  horse_id TEXT NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  am_amount REAL,  -- NULL = not assigned, 0 = deliberate zero
  pm_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (horse_id, feed_id)
);

-- Indexes for common queries
CREATE INDEX idx_feeds_display ON feeds(display_id);
CREATE INDEX idx_horses_display ON horses(display_id);
CREATE INDEX idx_diet_horse ON diet_entries(horse_id);
CREATE INDEX idx_diet_feed ON diet_entries(feed_id);
```

### 3.2 Entity Definitions

#### Display (Settings)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID primary key |
| `pair_code` | `string` | 6-digit pairing code |
| `timezone` | `string` | IANA timezone (e.g., "Australia/Sydney") |
| `time_mode` | `"AUTO" \| "AM" \| "PM"` | Current display mode |
| `override_until` | `string \| null` | ISO 8601 timestamp when manual override expires |
| `zoom_level` | `1 \| 2 \| 3` | Columns per page (1=10, 2=7, 3=5 horses) |
| `current_page` | `number` | Pagination index (0-based) |

#### Feed

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID primary key |
| `display_id` | `string` | Foreign key to displays |
| `name` | `string` | Display name |
| `unit` | `string` | Unit of measure (scoop, ml, sachet, biscuit) |
| `rank` | `number` | Usage-based ranking (lower = more popular) |
| `stock_level` | `number` | Current stock (future use, default 0) |
| `low_stock_threshold` | `number` | Alert threshold (future use, default 0) |

#### Horse

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID primary key |
| `display_id` | `string` | Foreign key to displays |
| `name` | `string` | Horse name |
| `note` | `string \| null` | Optional note text |
| `note_expiry` | `string \| null` | ISO 8601 timestamp when note auto-clears |
| `archived` | `boolean` | Soft delete for history (future use) |

#### Diet Entry

| Field | Type | Description |
|-------|------|-------------|
| `horse_id` | `string` | Foreign key to horses (composite PK) |
| `feed_id` | `string` | Foreign key to feeds (composite PK) |
| `am_amount` | `number \| null` | Morning quantity |
| `pm_amount` | `number \| null` | Afternoon quantity |

**Value semantics:**
- `NULL` = Feed not assigned to horse
- `0` = Deliberate zero (horse gets none of this feed)
- Both calculate as 0 in reports

### 3.3 Cascade Behavior

- Deleting a display cascades to all feeds, horses, and diet entries
- Deleting a feed cascades to all diet entries for that feed
- Deleting a horse cascades to all diet entries for that horse

## 4. API Reference

### 4.1 Bootstrap

#### `GET /api/bootstrap/:displayId`

Returns full relational state joined for frontend initialization. Single request to hydrate the entire UI.

*Response (200):*
```json
{
  "display": {
    "id": "d_abc123",
    "pairCode": "847291",
    "timezone": "Australia/Sydney",
    "timeMode": "AUTO",
    "overrideUntil": null,
    "zoomLevel": 2,
    "currentPage": 0
  },
  "feeds": [
    {
      "id": "f_uuid1",
      "name": "Easisport",
      "unit": "scoop",
      "rank": 1
    }
  ],
  "horses": [
    {
      "id": "h_uuid1",
      "name": "Spider",
      "note": "Turn out early",
      "noteExpiry": "2024-01-16T10:00:00Z",
      "archived": false
    }
  ],
  "diet": [
    {
      "horseId": "h_uuid1",
      "feedId": "f_uuid1",
      "amAmount": 0.5,
      "pmAmount": 0.5
    }
  ]
}
```

### 4.2 Display Lifecycle

#### `POST /api/displays`

Create a new display (stable).

*Response (201):*
```json
{
  "id": "d_abc123def456",
  "pairCode": "847291"
}
```

#### `PATCH /api/displays/:id`

Update display settings (timezone, zoom, page).

*Request:*
```json
{
  "timezone": "Europe/London",
  "zoomLevel": 3,
  "currentPage": 1
}
```

*Response (200):*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### `DELETE /api/displays/:id`

Remove a display and all associated data (cascades).

*Response (200):*
```json
{
  "success": true
}
```

### 4.3 Horses

#### `POST /api/displays/:displayId/horses`

Create a new horse.

*Request:*
```json
{
  "name": "Thunder"
}
```

*Response (201):*
```json
{
  "id": "h_uuid123",
  "name": "Thunder",
  "note": null,
  "noteExpiry": null,
  "archived": false
}
```

#### `PATCH /api/horses/:id`

Partial update to a horse. Only include fields to update.

*Request:*
```json
{
  "note": "Vet visit tomorrow",
  "noteExpiry": "2024-01-17T12:00:00Z"
}
```

*Response (200):*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### `DELETE /api/horses/:id`

Delete a horse and its diet entries.

*Response (200):*
```json
{
  "success": true
}
```

### 4.4 Feeds

#### `POST /api/displays/:displayId/feeds`

Create a new feed.

*Request:*
```json
{
  "name": "Easisport",
  "unit": "scoop"
}
```

*Response (201):*
```json
{
  "id": "f_uuid123",
  "name": "Easisport",
  "unit": "scoop",
  "rank": 0
}
```

#### `PATCH /api/feeds/:id`

Partial update to a feed.

*Request:*
```json
{
  "name": "Easisport Plus",
  "unit": "ml"
}
```

*Response (200):*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### `DELETE /api/feeds/:id`

Delete a feed and its diet entries.

*Response (200):*
```json
{
  "success": true
}
```

### 4.5 Diet

#### `PUT /api/diet`

Upsert diet entries. Creates if not exists, updates if exists.

*Request:*
```json
{
  "entries": [
    {
      "horseId": "h_uuid1",
      "feedId": "f_uuid1",
      "amAmount": 0.5,
      "pmAmount": 1
    },
    {
      "horseId": "h_uuid1",
      "feedId": "f_uuid2",
      "amAmount": null,
      "pmAmount": 0
    }
  ]
}
```

**Behavior:**
- If entry exists: UPDATE amounts
- If entry doesn't exist: INSERT new row
- If both amounts are `null`: DELETE the entry
- Operation is atomic (wrapped in transaction)

*Response (200):*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00Z",
  "affectedRows": 2
}
```

### 4.6 Time Mode

#### `PUT /api/displays/:id/time-mode`

Set time mode with optional override.

*Request:*
```json
{
  "mode": "PM"
}
```

**Behavior:**
- If mode is "AM" or "PM": sets `override_until` to now + 1 hour
- If mode is "AUTO": clears `override_until`

*Response (200):*
```json
{
  "success": true,
  "timeMode": "PM",
  "overrideUntil": "2024-01-15T11:35:00Z"
}
```

### 4.7 Pairing

#### `POST /api/pair`

Pair a controller with a display using the 6-digit code.

*Request:*
```json
{
  "code": "847291"
}
```

*Validation:* Code must be exactly 6 digits (Zod validated).

*Response (200):*
```json
{
  "success": true,
  "displayId": "d_abc123def456"
}
```

*Response (404):*
```json
{
  "success": false,
  "error": "Invalid pairing code"
}
```

### 4.8 Server-Sent Events

#### `GET /api/displays/:id/events`

SSE endpoint for real-time updates.

*Headers:*
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

*Event types:*

| Event | Payload | When |
|-------|---------|------|
| `bootstrap` | Full state (see 4.1) | Initial connection |
| `settings` | Display settings only | Settings change |
| `horses` | Updated horses array | Horse add/edit/delete |
| `feeds` | Updated feeds array | Feed add/edit/delete |
| `diet` | Updated diet entries | Diet change |
| (comment) | `: keepalive` | Every 30 seconds |

*Example:*
```
event: bootstrap
data: {"display":{...},"feeds":[...],"horses":[...],"diet":[...]}

event: diet
data: [{"horseId":"h1","feedId":"f1","amAmount":0.5,"pmAmount":1}]

: keepalive
```

### 4.9 Health Check

#### `GET /health`

*Response (200):*
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 5. Validation (Zod Schemas)

All validation schemas live in `src/shared/schemas/` and are used by both API middleware and frontend forms.

### 5.1 Schema Definitions

```typescript
// src/shared/schemas/feed.ts
import { z } from 'zod';

export const UnitSchema = z.enum(['scoop', 'ml', 'sachet', 'biscuit']);

export const FeedSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  unit: UnitSchema,
  rank: z.number().int().min(0),
});

export const CreateFeedSchema = FeedSchema.pick({ name: true, unit: true });
export const UpdateFeedSchema = FeedSchema.partial().omit({ id: true });

// src/shared/schemas/horse.ts
export const HorseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  note: z.string().max(200).nullable(),
  noteExpiry: z.string().datetime().nullable(),
  archived: z.boolean(),
});

export const CreateHorseSchema = HorseSchema.pick({ name: true });
export const UpdateHorseSchema = HorseSchema.partial().omit({ id: true });

// src/shared/schemas/diet.ts
export const DietEntrySchema = z.object({
  horseId: z.string().uuid(),
  feedId: z.string().uuid(),
  amAmount: z.number().min(0).max(100).nullable(),
  pmAmount: z.number().min(0).max(100).nullable(),
});

export const UpsertDietSchema = z.object({
  entries: z.array(DietEntrySchema),
});

// src/shared/schemas/pair-code.ts
export const PairCodeSchema = z.string().regex(/^\d{6}$/, 'Must be exactly 6 digits');
```

### 5.2 API Middleware

```typescript
// src/server/middleware/validate.ts
import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}
```

### 5.3 Frontend Form Validation

```typescript
// Example: Horse edit form
import { UpdateHorseSchema } from '@shared/schemas/horse';

function handleSubmit(formData: unknown) {
  const result = UpdateHorseSchema.safeParse(formData);
  if (!result.success) {
    setErrors(result.error.flatten().fieldErrors);
    return;
  }
  await api.updateHorse(horseId, result.data);
}
```

## 6. Frontend Architecture

### 6.1 Project Structure

```
src/
├── shared/                    # Shared between client and server
│   ├── schemas/               # Zod schemas
│   │   ├── feed.ts
│   │   ├── horse.ts
│   │   ├── diet.ts
│   │   └── index.ts
│   ├── time-mode.ts           # AM/PM calculation logic
│   ├── fractions.ts           # Decimal to fraction formatting
│   └── types.ts               # TypeScript interfaces
├── client/
│   ├── components/
│   │   ├── Grid/              # Shared grid component
│   │   │   ├── Grid.tsx       # Main grid (accepts isEditable prop)
│   │   │   ├── GridCell.tsx
│   │   │   ├── GridHeader.tsx
│   │   │   └── GridFooter.tsx
│   │   ├── NumericKeypad.tsx
│   │   └── ...
│   ├── views/
│   │   ├── Display.tsx        # TV view (uses Grid with isEditable=false)
│   │   └── Controller/
│   │       ├── Board.tsx      # Uses Grid with isEditable=true
│   │       ├── Horses.tsx
│   │       ├── Feeds.tsx
│   │       └── Reports.tsx
│   ├── stores/                # Preact Signal stores
│   │   ├── display.ts
│   │   ├── horses.ts
│   │   ├── feeds.ts
│   │   └── diet.ts
│   └── main.tsx
└── server/
    ├── routes/
    ├── middleware/
    └── db/
```

### 6.2 Shared Grid Component

The Grid component is designed for reuse across TV Display and Controller.

```typescript
// src/client/components/Grid/Grid.tsx
import { Signal } from '@preact/signals';

interface GridProps {
  horses: Signal<Horse[]>;
  feeds: Signal<Feed[]>;
  diet: Signal<DietEntry[]>;
  timeMode: Signal<TimeMode>;
  currentPage: Signal<number>;
  horsesPerPage: number;
  isEditable: boolean;  // Key prop for TV vs Controller
  onCellClick?: (horseId: string, feedId: string) => void;
  onNoteClick?: (horseId: string) => void;
}

export function Grid({
  horses,
  feeds,
  diet,
  timeMode,
  isEditable,
  onCellClick,
  onNoteClick,
}: GridProps) {
  // Render grid with conditional editing UI
  return (
    <div class="grid">
      <GridHeader horses={horses} />
      <GridBody
        horses={horses}
        feeds={feeds}
        diet={diet}
        timeMode={timeMode}
        isEditable={isEditable}
        onCellClick={onCellClick}
      />
      <GridFooter
        horses={horses}
        isEditable={isEditable}
        onNoteClick={onNoteClick}
      />
    </div>
  );
}
```

**Usage:**

```typescript
// TV Display (read-only)
<Grid
  horses={horses}
  feeds={feeds}
  diet={diet}
  timeMode={timeMode}
  isEditable={false}
/>

// Controller Board (editable)
<Grid
  horses={horses}
  feeds={feeds}
  diet={diet}
  timeMode={timeMode}
  isEditable={true}
  onCellClick={handleCellClick}
  onNoteClick={handleNoteClick}
/>
```

### 6.3 State Management (Preact Signals)

```typescript
// src/client/stores/diet.ts
import { signal, computed } from '@preact/signals';
import type { DietEntry } from '@shared/types';

// Raw state
export const dietEntries = signal<DietEntry[]>([]);

// Derived state: diet indexed by horse and feed for O(1) lookup
export const dietByHorseAndFeed = computed(() => {
  const map = new Map<string, DietEntry>();
  for (const entry of dietEntries.value) {
    map.set(`${entry.horseId}:${entry.feedId}`, entry);
  }
  return map;
});

// Actions
export function updateDietEntry(horseId: string, feedId: string, field: 'amAmount' | 'pmAmount', value: number | null) {
  const key = `${horseId}:${feedId}`;
  const existing = dietByHorseAndFeed.value.get(key);

  if (existing) {
    dietEntries.value = dietEntries.value.map(e =>
      e.horseId === horseId && e.feedId === feedId
        ? { ...e, [field]: value }
        : e
    );
  } else {
    dietEntries.value = [
      ...dietEntries.value,
      { horseId, feedId, amAmount: null, pmAmount: null, [field]: value }
    ];
  }
}
```

### 6.4 Time Mode Logic (Shared)

```typescript
// src/shared/time-mode.ts
export type TimeMode = 'AUTO' | 'AM' | 'PM';

export interface TimeModeState {
  mode: TimeMode;
  overrideUntil: string | null;
}

/**
 * Calculate effective time mode based on current time and override.
 */
export function getEffectiveTimeMode(
  state: TimeModeState,
  timezone: string,
  now: Date = new Date()
): 'AM' | 'PM' {
  // Check if override is still valid
  if (state.mode !== 'AUTO' && state.overrideUntil) {
    if (new Date(state.overrideUntil) > now) {
      return state.mode as 'AM' | 'PM';
    }
  }

  // Auto-detect based on timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(now), 10);

  // 04:00 - 11:59 = AM, 12:00 - 03:59 = PM
  return (hour >= 4 && hour < 12) ? 'AM' : 'PM';
}

/**
 * Check if override has expired.
 */
export function isOverrideExpired(overrideUntil: string | null, now: Date = new Date()): boolean {
  if (!overrideUntil) return true;
  return new Date(overrideUntil) <= now;
}
```

### 6.5 Fraction Formatting (Shared)

```typescript
// src/shared/fractions.ts
const FRACTION_MAP: Record<number, string> = {
  0.25: '¼',
  0.33: '⅓',
  0.5: '½',
  0.67: '⅔',
  0.75: '¾',
};

/**
 * Format a decimal quantity for display.
 */
export function formatQuantity(value: number | null, unit: string): string {
  if (value === null || value === 0) return '';

  const intPart = Math.floor(value);
  const decPart = value - intPart;

  // Check for known fractions
  const fraction = FRACTION_MAP[Math.round(decPart * 100) / 100];

  if (fraction) {
    if (intPart === 0) return fraction;
    return `${intPart}${fraction}`;
  }

  // Fall back to decimal with unit
  return `${value} ${unit}`;
}
```

## 7. Server Business Logic

### 7.1 Feed Ranking

After any diet change, recalculate ranks:

```sql
UPDATE feeds SET rank = (
  SELECT COUNT(DISTINCT horse_id)
  FROM diet_entries
  WHERE feed_id = feeds.id
    AND (am_amount > 0 OR pm_amount > 0)
)
WHERE display_id = ?;
```

Feeds with higher usage get lower rank numbers (rank 1 = most used).

### 7.2 Time Mode Expiry

Server checks every minute:

```typescript
// Check all displays for expired overrides
const expired = await db.all(`
  SELECT id FROM displays
  WHERE time_mode != 'AUTO'
    AND override_until IS NOT NULL
    AND override_until < datetime('now')
`);

for (const display of expired) {
  await db.run(`
    UPDATE displays
    SET time_mode = 'AUTO', override_until = NULL, updated_at = datetime('now')
    WHERE id = ?
  `, display.id);

  broadcast(display.id, 'settings', { timeMode: 'AUTO', overrideUntil: null });
}
```

### 7.3 Note Expiry

Server checks hourly:

```typescript
const expired = await db.all(`
  SELECT id, display_id FROM horses
  WHERE note IS NOT NULL
    AND note_expiry IS NOT NULL
    AND note_expiry < datetime('now')
`);

for (const horse of expired) {
  await db.run(`
    UPDATE horses
    SET note = NULL, note_expiry = NULL, updated_at = datetime('now')
    WHERE id = ?
  `, horse.id);

  broadcastHorseUpdate(horse.display_id);
}
```

### 7.4 Atomic Transactions

Diet upserts are wrapped in transactions:

```typescript
async function upsertDiet(entries: DietEntry[]) {
  await db.run('BEGIN TRANSACTION');
  try {
    for (const entry of entries) {
      if (entry.amAmount === null && entry.pmAmount === null) {
        await db.run(
          'DELETE FROM diet_entries WHERE horse_id = ? AND feed_id = ?',
          entry.horseId, entry.feedId
        );
      } else {
        await db.run(`
          INSERT INTO diet_entries (horse_id, feed_id, am_amount, pm_amount)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(horse_id, feed_id) DO UPDATE SET
            am_amount = excluded.am_amount,
            pm_amount = excluded.pm_amount,
            updated_at = datetime('now')
        `, entry.horseId, entry.feedId, entry.amAmount, entry.pmAmount);
      }
    }
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}
```

## 8. TV Display

### 8.1 Grid Layout

- **Header row:** Horse names
- **Body rows:** One per feed (showing AM or PM value based on time mode)
- **Footer row:** Horse notes

Only show feeds that have at least one non-zero value across visible horses.

### 8.2 Behavior

1. Check localStorage for `displayId`
2. If none, `POST /api/displays` to create session
3. Show pairing code until data arrives
4. Connect to SSE, render grid on `bootstrap` event
5. Update reactively on subsequent events
6. Auto-reconnect on disconnect (exponential backoff)

**URL:** `/display`

## 9. Mobile Controller

### 9.1 Navigation

Tab bar: **[Board] [Horses] [Feeds] [Reports]**

### 9.2 Board Tab

Uses shared Grid component with `isEditable={true}`:

- Tap cell → Numeric keypad for quantity
- Tap horse name → Navigate to horse detail
- Tap note → Edit note inline

**Controls:**
- AM/PM/AUTO toggle
- Zoom: [-] [+]
- Page: [<] [Page X of Y] [>]

### 9.3 Horses Tab

List of horse cards. Tapping opens detail view:

- **Header:** Name + "Clone Diet From" dropdown
- **Notes:** Text field + expiry (None, 24h, 48h)
- **Warning:** Highlight if note >24h old without expiry
- **Feeds:** Active feeds (editable) + inactive feeds (tap to add)

### 9.4 Feeds Tab

Manage master feed list:
- Create, rename, delete feeds
- Set unit (Scoop, ml, Biscuit, Sachet)
- Delete confirmation (cascades to diet entries)

### 9.5 Reports Tab

Weekly consumption per feed:

```typescript
// Calculate from diet entries
const weeklyConsumption = feeds.map(feed => {
  const entries = dietEntries.filter(e => e.feedId === feed.id);
  const dailyTotal = entries.reduce((sum, e) =>
    sum + (e.amAmount ?? 0) + (e.pmAmount ?? 0), 0
  );
  return {
    feed: feed.name,
    weekly: Math.round(dailyTotal * 7 * 100) / 100,
    unit: feed.unit + 's',
  };
});
```

| Feed | Weekly | Unit |
|------|--------|------|
| Easisport | 45.50 | scoops |
| Bute | 14.00 | sachets |

**URL:** `/controller`

## 10. Data Flow

### 10.1 Pairing

```
TV: POST /api/displays → receives displayId + pairCode
TV: Shows "847291" on screen
TV: Connects to /api/displays/:id/events
TV: Receives "bootstrap" event, renders grid

Mobile: User enters "847291"
Mobile: POST /api/pair {code} → receives displayId
Mobile: GET /api/bootstrap/:displayId → hydrates state
Mobile: Connects to SSE for updates
```

### 10.2 Editing

```
Mobile: User changes Spider's Easisport to 0.5
Mobile: PUT /api/diet { entries: [{ horseId, feedId, amAmount: 0.5, pmAmount: null }] }

Server: Validates with Zod schema
Server: Runs atomic transaction
Server: Recalculates feed rankings
Server: Broadcasts "diet" event to SSE clients

TV: Receives "diet" event
TV: Signal updates, Grid re-renders affected cells only
```

## 11. Error Handling

### 11.1 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PUT, PATCH, DELETE) |
| 201 | Created (POST) |
| 400 | Validation error (Zod) |
| 404 | Not found |
| 500 | Server error |

### 11.2 Error Response Format

```json
{
  "success": false,
  "error": "Human-readable message",
  "details": {
    "fieldErrors": {
      "name": ["String must contain at least 1 character(s)"]
    }
  }
}
```

### 11.3 Client-Side Error Handling

**TV Display:**
- SSE connection failures trigger "Connection Lost" overlay
- Exponential backoff reconnection: 1s, 2s, 4s, 8s... up to 30s max
- Overlay auto-hides when connection restores

**Mobile Controller:**
- Network failures show toast notifications
- Form validation errors highlight fields inline
- Sync status indicator: Ready, Saving, Saved, Error

## 12. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/horseboard.db` | Database path |
| `NODE_ENV` | `development` | Environment |

## 13. Future Considerations

| Feature | Prepared By |
|---------|-------------|
| Inventory tracking | `stock_level`, `low_stock_threshold` columns |
| Horse history | `archived` column, `created_at`/`updated_at` timestamps |
| Audit log | All tables have timestamps |
| Offline editing | Signal-based state enables local-first architecture |
| Multiple controllers | Granular endpoints reduce conflict scope |
| User authentication | Display ownership via user FK (future migration) |
