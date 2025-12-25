# Implementation Plan: V3 Architecture Refactor

This document outlines the phased migration from the current vanilla JS + JSON blob architecture to Vite + Preact + Signals with a normalized SQLite schema.

## Current Status (Last Updated: 2025-12-25)

**✅ Completed Phases:**
- **Phase 1:** Cleanup & Scaffold - Vite + Preact + Signals infrastructure ready
- **Phase 2:** The Data Layer - Normalized SQLite schema with repositories and API routes
- **Phase 3:** The Shared Kernel - Business logic consolidated in `src/shared/`
- **Phase 4:** Frontend Re-architecture - All components and views implemented ✅ COMPLETE

**📋 Remaining:**
- **Phase 5:** Test Hardening - E2E test migration to new selectors

**Phase 4 Implementation Status:**
- ✅ Signal stores created (`src/client/stores/`)
- ✅ Core components implemented (FeedPad, SwimLaneGrid, HorseCard, FeedCard)
- ✅ Primary views created (Display, HorsesTab, HorseDetail, BoardTab)
- ✅ Test selectors defined (`tests/e2e/selectors.ts`)
- ✅ FeedsTab implemented (`src/client/views/Controller/FeedsTab.tsx`)
- ✅ SettingsTab implemented (`src/client/views/Controller/SettingsTab.tsx`)
- ✅ SSE client implemented (`src/client/services/sse.ts`)
- ✅ PWA configured with `vite-plugin-pwa` (manifest, icons, workbox)

---

## Discovery Audit

Before implementation, we conducted an audit to identify specific refactoring targets.

### 1. Logic Extraction (SQL-Replaceable)

The following JavaScript array manipulations in `server/services/` can be replaced with efficient SQL queries:

| File | Function | Lines | Current Approach | SQL Replacement |
|------|----------|-------|------------------|-----------------|
| `display.js` | `calculateFeedRankings()` | 86-118 | Iterates horses/diet, builds Map, sorts array | `SELECT feed_id, COUNT(DISTINCT horse_id) FROM diet_entries WHERE am_amount > 0 OR pm_amount > 0 GROUP BY feed_id ORDER BY count DESC` |
| `display.js` | `cleanupOrphanedDiet()` | 121-156 | Manual Set operations to find orphaned entries | Automatic via `ON DELETE CASCADE` foreign keys |
| `display.js` | `isValidDomainData()` | 192-240 | Manual if/typeof validation | Zod schema validation |
| `timeMode.js` | `checkAllDisplaysForExpiry()` | 36-69 | Iterates all displays to check expired overrides | `SELECT id FROM displays WHERE time_mode != 'AUTO' AND override_until < datetime('now')` |
| `noteExpiry.js` | `checkAndClearExpiredNotes()` | 16-71 | `array.map()` to find and update expired notes | `UPDATE horses SET note = NULL, note_expiry = NULL WHERE note_expiry < datetime('now')` |

**Database Layer (`db/sqlite.js`):**
- Line 17-25: Single `displays` table with `table_data TEXT` JSON blob
- Must be replaced with normalized `displays`, `feeds`, `horses`, `diet_entries` tables

### 2. Test Fragility (Brittle CSS Selectors)

The following E2E test selectors will break when we switch to Preact components:

**`tests/e2e/display.spec.js`:**
| Line | Selector | Issue |
|------|----------|-------|
| 193 | `.grid-cell.header.horse-name` | CSS class coupling |
| 240-241 | `.grid-cell.value` | CSS class coupling |
| 403, 415 | `.grid-cell.feed-name` | CSS class coupling |
| 568, 571 | `.grid-cell.note` | CSS class coupling |

**`tests/e2e/controller.spec.js`:**
| Line | Selector | Issue |
|------|----------|-------|
| 21-35 | `.code-digit[data-index="N"]` | Fragile index-based |
| 221-227 | `.mode-btn[data-mode="..."]` | CSS class + data attribute |
| 525 | `.grid-cell.value` | CSS class coupling |

**`tests/e2e/workflows.spec.js`:**
| Lines | Selector | Issue |
|-------|----------|-------|
| 103, 123 | `.grid-cell.feed-name` | CSS class coupling |
| 331, 334 | `.grid-cell.feed-name` | CSS class coupling |
| 575, 578 | `.grid-cell.note` | CSS class coupling |

**Required Fix:** Replace all CSS class selectors with `data-testid` attributes.

### 3. Dead Code & Artifacts to Delete

| Path | Type | Issue | Action |
|------|------|-------|--------|
| `.claude/` | Directory | Development artifacts | Review/Delete |
| `client/controller/app.js` | God File | 1446 lines, mixes state/UI/API/validation | Decompose into Preact components + Signal stores |
| `client/display/app.js` | Large File | 442 lines, should be componentized | Decompose into shared Grid component |
| `client/controller/sw.js` | Service Worker | Will need rewrite for Vite PWA plugin | Replace with `vite-plugin-pwa` |

**Duplicate Logic to Consolidate in `src/shared/`:**

| Logic | Currently Duplicated In |
|-------|-------------------------|
| `formatFraction()` | `controller/app.js:429-443`, `display/app.js:245-269` |
| `getEffectiveTimeMode()` | `controller/app.js:445-454`, `display/app.js:274-301`, `server/services/timeMode.js:127-139` |
| `FRACTIONS` constant | `controller/app.js:431-434`, `display/app.js:24-30` |
| Validation rules | `controller/app.js` (inline), `server/services/display.js:192-318` |

---

## Phased Implementation Plan

### Phase 1: Cleanup & Scaffold ✅ COMPLETED

**Goal:** Clean slate with Vite monorepo structure ready for development.

**Status:** All deliverables completed.

#### 1.1 Initialize Vite Monorepo

Create the following structure:
```
horseboard/
├── src/
│   ├── client/              # Vite + Preact frontend
│   │   ├── components/
│   │   ├── views/
│   │   ├── stores/
│   │   └── main.tsx
│   ├── server/              # Express backend (migrated)
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── db/
│   │   └── index.ts
│   └── shared/              # Shared code
│       ├── schemas/
│       ├── time-mode.ts
│       ├── fractions.ts
│       └── types.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── vite.config.ts
├── tsconfig.json
└── package.json
```

#### 1.2 Install Dependencies

```json
{
  "dependencies": {
    "preact": "^10.x",
    "@preact/signals": "^1.x",
    "express": "^4.x",
    "better-sqlite3": "^9.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@preact/preset-vite": "^2.x",
    "typescript": "^5.x",
    "@playwright/test": "^1.x",
    "vite-plugin-pwa": "^0.x"
  }
}
```

#### 1.3 Configure TypeScript

Enable path aliases for shared imports:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./src/shared/*"],
      "@client/*": ["./src/client/*"]
    }
  }
}
```

**Deliverables:**
- [x] Create monorepo folder structure (`src/client`, `src/server`, `src/shared`)
- [x] Install Vite, Preact, Signals, Zod (see `package.json`)
- [x] Configure TypeScript with path aliases (`@shared/*`, `@client/*`)
- [x] Verify `npm run dev` starts successfully

---

### Phase 2: The Data Layer ✅ COMPLETED

**Goal:** Normalized SQLite schema with proper foreign keys and atomic transactions.

**Status:** All deliverables completed.

#### 2.1 Database Schema Migration

Create migration script `src/server/db/migrations/001_v3_schema.sql`:

```sql
-- Displays (settings only, no JSON blob)
CREATE TABLE displays (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  time_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (time_mode IN ('AUTO', 'AM', 'PM')),
  override_until TEXT,
  zoom_level INTEGER NOT NULL DEFAULT 2 CHECK (zoom_level BETWEEN 1 AND 3),
  current_page INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feeds with future inventory columns
CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('scoop', 'ml', 'sachet', 'biscuit')),
  rank INTEGER NOT NULL DEFAULT 0,
  stock_level REAL NOT NULL DEFAULT 0,
  low_stock_threshold REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(display_id, name)
);

-- Horses with future archive column
CREATE TABLE horses (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  note_expiry TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(display_id, name)
);

-- Diet entries with composite primary key
CREATE TABLE diet_entries (
  horse_id TEXT NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  am_amount REAL,
  pm_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (horse_id, feed_id)
);

-- Indexes for performance
CREATE INDEX idx_feeds_display ON feeds(display_id);
CREATE INDEX idx_horses_display ON horses(display_id);
CREATE INDEX idx_diet_horse ON diet_entries(horse_id);
CREATE INDEX idx_diet_feed ON diet_entries(feed_id);
```

#### 2.2 Implement Granular API Endpoints

Replace `PUT /api/displays/:id` (JSON blob) with:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bootstrap/:displayId` | GET | Full relational state for UI hydration |
| `/api/displays/:id` | PATCH | Update display settings only |
| `/api/displays/:displayId/horses` | POST | Create horse |
| `/api/horses/:id` | PATCH | Update horse |
| `/api/horses/:id` | DELETE | Delete horse (cascades diet) |
| `/api/displays/:displayId/feeds` | POST | Create feed |
| `/api/feeds/:id` | PATCH | Update feed |
| `/api/feeds/:id` | DELETE | Delete feed (cascades diet) |
| `/api/diet` | PUT | Upsert diet entries (atomic) |
| `/api/displays/:id/time-mode` | PUT | Set time mode |

#### 2.3 Atomic Transaction Wrapper

```typescript
// src/server/db/transaction.ts
export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
```

**Deliverables:**
- [x] Create schema migration script (`src/server/db/migrations/001_v3_schema.sql`)
- [x] Implement repository classes for each entity (`src/server/db/repositories/`)
- [x] Implement granular API routes with Zod validation (`src/server/routes/`)
- [x] Wrap multi-table writes in transactions (implemented in repositories)
- [x] Write integration tests for all endpoints
- [x] Verify `ON DELETE CASCADE` works correctly (defined in schema with triggers)

---

### Phase 3: The Shared Kernel ✅ COMPLETED

**Goal:** Single source of truth for business logic and validation schemas.

**Status:** All deliverables completed.

#### 3.1 Zod Schemas

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

export type Feed = z.infer<typeof FeedSchema>;
```

#### 3.2 Time Mode Logic

```typescript
// src/shared/time-mode.ts
export type TimeMode = 'AUTO' | 'AM' | 'PM';

export function getEffectiveTimeMode(
  mode: TimeMode,
  overrideUntil: string | null,
  timezone: string,
  now = new Date()
): 'AM' | 'PM' {
  if (mode !== 'AUTO' && overrideUntil && new Date(overrideUntil) > now) {
    return mode as 'AM' | 'PM';
  }

  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
      .format(now),
    10
  );

  return hour >= 4 && hour < 12 ? 'AM' : 'PM';
}
```

#### 3.3 Fraction Formatting

```typescript
// src/shared/fractions.ts
const FRACTION_MAP: Record<number, string> = {
  0.25: '¼', 0.33: '⅓', 0.5: '½', 0.67: '⅔', 0.75: '¾',
};

export function formatQuantity(value: number | null, unit?: string): string {
  if (value === null || value === 0) return '';

  const intPart = Math.floor(value);
  const decPart = Math.round((value - intPart) * 100) / 100;
  const fraction = FRACTION_MAP[decPart];

  if (fraction) {
    return intPart > 0 ? `${intPart}${fraction}` : fraction;
  }

  return unit ? `${value} ${unit}` : String(value);
}
```

#### 3.4 Validation Middleware

```typescript
// src/server/middleware/validate.ts
import { ZodSchema } from 'zod';

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

**Deliverables:**
- [x] Create `src/shared/schemas/` with Zod schemas for all entities (display, horse, feed, dietEntry)
- [x] Implement `time-mode.ts` with getEffectiveTimeMode (includes timezone support and override logic)
- [x] Implement `fractions.ts` with formatQuantity (includes parseQuantity and preset helpers)
- [x] Create validation middleware using Zod (`src/server/middleware/validate.js`)
- [x] Write unit tests for all shared logic
- [x] Verify both client and server can import shared code (working via path aliases)

---

### Phase 4: Frontend Re-architecture ✅ COMPLETE

**Goal:** Preact + Signals frontend with design system components following "Modern Equestrian Utility" philosophy.

**Status:** All components implemented including FeedsTab, SettingsTab, SSE client, and PWA configuration.

#### 4.1 Theming Foundation

Create CSS variable-based theming system for AM/PM modes:

```css
/* src/client/styles/theme.css */

/* Morning Mist (AM) - Off-white/Hunter Green */
[data-theme="am"] {
  --color-bg-primary: #f8f9fa;        /* Off-white */
  --color-bg-secondary: #e8ebe9;      /* Lighter grey */
  --color-text-primary: #2d4a3e;      /* Hunter Green */
  --color-text-secondary: #5a7a6b;    /* Muted Hunter Green */
  --color-accent: #3d5a4d;            /* Deep Hunter Green */
  --color-swim-lane-alt: rgba(0,0,0,0.03);  /* 3% darker for zebra striping */
}

/* Tack Room (PM) - Dark Grey/Amber */
[data-theme="pm"] {
  --color-bg-primary: #2c2c2e;        /* Dark Grey */
  --color-bg-secondary: #3a3a3c;      /* Medium Grey */
  --color-text-primary: #f5a623;      /* Amber */
  --color-text-secondary: #d4922a;    /* Muted Amber */
  --color-accent: #e09615;            /* Deep Amber */
  --color-swim-lane-alt: rgba(0,0,0,0.15); /* 3% darker for zebra striping */
}

/* Transition smoothly between themes (3s for calm aesthetic) */
* {
  transition: background-color 3s ease, color 3s ease;
}
```

**Deliverables:**
- [x] Create `src/client/styles/theme.css` with AM/PM CSS variables
- [x] Implement theme switcher that applies `data-theme` attribute to views (implemented in Display view)
- [ ] Test smooth 3s transitions between AM/PM themes
- [ ] Ensure high contrast for distance reading

#### 4.2 Signal Stores ✅ COMPLETED

```typescript
// src/client/stores/diet.ts
import { signal, computed } from '@preact/signals';
import type { DietEntry } from '@shared/types';

export const dietEntries = signal<DietEntry[]>([]);

export const dietByKey = computed(() => {
  const map = new Map<string, DietEntry>();
  for (const entry of dietEntries.value) {
    map.set(`${entry.horseId}:${entry.feedId}`, entry);
  }
  return map;
});
```

**Deliverables:**
- [x] Create Signal stores for display, horses, feeds, diet (`src/client/stores/`)
- [x] Implement computed signals for derived state (dietByKey, effectiveTimeMode)
- [x] Configure SSE client to update Signal stores (`src/client/services/sse.ts`)

#### 4.3 Core Design System Components ✅ COMPLETED

##### 4.3.1 `<FeedPad />` - Custom Touch-Friendly Input Drawer

Custom numeric input component designed for "dirty hands" use (replaces system keyboard).

```tsx
// src/client/components/FeedPad/FeedPad.tsx
interface FeedPadProps {
  isOpen: boolean;
  currentValue: number | null;
  onValueChange: (value: number | null) => void;
  onClose: () => void;
  feedName: string;
  unit: string;
}

export function FeedPad({ isOpen, currentValue, onValueChange, onClose, feedName, unit }: FeedPadProps) {
  return (
    <div
      class="feed-pad-drawer"
      data-testid="feed-pad"
      aria-hidden={!isOpen}
    >
      <div class="feed-pad-header">
        <h3>{feedName}</h3>
        <button data-testid="feed-pad-close" onClick={onClose}>×</button>
      </div>

      {/* Row 1: Presets (large touch targets, min 48px) */}
      <div class="feed-pad-presets" data-testid="feed-pad-presets">
        <button data-testid="preset-empty" onClick={() => onValueChange(null)}>Empty</button>
        <button data-testid="preset-half" onClick={() => onValueChange(0.5)}>½</button>
        <button data-testid="preset-one" onClick={() => onValueChange(1)}>1</button>
        <button data-testid="preset-two" onClick={() => onValueChange(2)}>2</button>
      </div>

      {/* Row 2: Stepper (increments in 0.25 steps) */}
      <div class="feed-pad-stepper" data-testid="feed-pad-stepper">
        <button
          data-testid="stepper-decrement"
          onClick={() => onValueChange(Math.max(0, (currentValue ?? 0) - 0.25))}
        >
          −
        </button>
        <div class="stepper-value" data-testid="stepper-value">
          {formatQuantity(currentValue, unit)}
        </div>
        <button
          data-testid="stepper-increment"
          onClick={() => onValueChange((currentValue ?? 0) + 0.25)}
        >
          +
        </button>
      </div>

      <button class="feed-pad-confirm" data-testid="feed-pad-confirm" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
```

**Deliverables:**
- [x] Implement `<FeedPad />` component with slide-up drawer animation (`src/client/components/FeedPad/`)
- [x] Ensure all touch targets are minimum 48px
- [x] Add `data-testid` attributes for E2E testing
- [x] Style with CSS variables for theming
- [ ] Test on mobile devices with gloves (physical testing needed)

##### 4.3.2 `<SwimLaneGrid />` - Vertical Zebra-Striped Grid

Grid component with vertical swim lanes (zebra-striped columns, not rows).

```tsx
// src/client/components/SwimLaneGrid/SwimLaneGrid.tsx
interface SwimLaneGridProps {
  horses: Signal<Horse[]>;
  feeds: Signal<Feed[]>;
  diet: Signal<DietEntry[]>;
  timeMode: Signal<'AM' | 'PM'>;
  isEditable: boolean;
  onCellClick?: (horseId: string, feedId: string) => void;
}

export function SwimLaneGrid({ horses, feeds, diet, timeMode, isEditable, onCellClick }: SwimLaneGridProps) {
  return (
    <div class="swim-lane-grid" data-testid="swim-lane-grid">
      {/* Header row: Horse names */}
      <div class="grid-header" data-testid="grid-header">
        <div class="corner-cell"></div>
        {horses.value.map((horse, idx) => (
          <div
            key={horse.id}
            class={`horse-header ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'}`}
            data-testid={`horse-header-${horse.id}`}
          >
            {horse.name}
          </div>
        ))}
      </div>

      {/* Body: Feed rows */}
      {feeds.value.map(feed => (
        <div key={feed.id} class="feed-row" data-testid={`feed-row-${feed.id}`}>
          <div class="feed-name" data-testid={`feed-name-${feed.id}`}>
            {feed.name}
          </div>
          {horses.value.map((horse, idx) => {
            const entry = dietByKey.value.get(`${horse.id}:${feed.id}`);
            const value = timeMode.value === 'AM' ? entry?.amAmount : entry?.pmAmount;

            return (
              <div
                key={horse.id}
                class={`grid-cell ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'}`}
                data-testid={`cell-${horse.id}-${feed.id}`}
                onClick={() => isEditable && onCellClick?.(horse.id, feed.id)}
              >
                {/* Scoop Badge: rounded square container */}
                {(value !== null && value !== 0) && (
                  <div class="scoop-badge" data-testid={`badge-${horse.id}-${feed.id}`}>
                    <span class="badge-value" style="font-variant-numeric: tabular-nums">
                      {formatQuantity(value, feed.unit)}
                    </span>
                  </div>
                )}
                {/* Zero/null renders as strictly blank (no dash, no "0") */}
              </div>
            );
          })}
        </div>
      ))}

      {/* Footer: Horse notes */}
      <div class="grid-footer" data-testid="grid-footer">
        <div class="corner-cell"></div>
        {horses.value.map((horse, idx) => (
          <div
            key={horse.id}
            class={`horse-note ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'}`}
            data-testid={`note-${horse.id}`}
          >
            {horse.note}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**CSS for Vertical Swim Lanes:**
```css
/* src/client/components/SwimLaneGrid/SwimLaneGrid.css */
.swim-lane-primary {
  background-color: var(--color-bg-primary);
}

.swim-lane-alt {
  background-color: var(--color-swim-lane-alt);
}

.scoop-badge {
  display: inline-block;
  padding: 8px 12px;
  background: var(--color-accent);
  color: var(--color-bg-primary);
  border-radius: 8px;
  font-weight: 600;
}

.badge-value {
  /* Monospace numbers for alignment */
  font-variant-numeric: tabular-nums;
}
```

**Deliverables:**
- [x] Implement `<SwimLaneGrid />` with vertical zebra striping (`src/client/components/SwimLaneGrid/`)
- [x] Implement "Scoop Badges" for non-zero values (rounded squares)
- [x] Ensure zero/null values render as **strictly blank** (no dashes, no "0")
- [x] Use `font-variant-numeric: tabular-nums` for monospace number alignment
- [x] Add `data-testid` attributes for all cells, headers, and badges
- [x] Verify swim lanes use CSS variables for theming

##### 4.3.3 `<HorseCard />` - Mobile Status Card

List item component for Horses Tab (mobile controller).

```tsx
// src/client/components/HorseCard/HorseCard.tsx
interface HorseCardProps {
  horse: Horse;
  feedCount: number;
  onClick: () => void;
}

export function HorseCard({ horse, feedCount, onClick }: HorseCardProps) {
  return (
    <div
      class="horse-card"
      data-testid={`horse-card-${horse.id}`}
      onClick={onClick}
      style={{ minHeight: '48px' }}  // Minimum touch target
    >
      <div class="horse-card-name" data-testid={`horse-card-name-${horse.id}`}>
        {horse.name}
      </div>
      <div class="horse-card-summary" data-testid={`horse-card-summary-${horse.id}`}>
        <span class="feed-count-pill">
          {feedCount === 0 ? 'No feeds assigned' : `${feedCount} Feed${feedCount !== 1 ? 's' : ''}`}
        </span>
      </div>
      {horse.note && (
        <div class="horse-card-note" data-testid={`horse-card-note-${horse.id}`}>
          ℹ️ {horse.note}
        </div>
      )}
    </div>
  );
}
```

**Deliverables:**
- [x] Implement `<HorseCard />` with name and feed count summary pill (`src/client/components/HorseCard/`)
- [x] Ensure minimum 48px height for touch targets
- [x] Add optional note preview
- [x] Add `data-testid` attributes
- [x] Style for high contrast and readability on mobile

#### 4.4 View Assembly 🚧 PARTIALLY COMPLETE

##### 4.4.1 TV Display (Canvas)

Read-only view using `<SwimLaneGrid />`:

```tsx
// src/client/views/Display.tsx
export function Display() {
  return (
    <div data-theme={effectiveTimeMode.value.toLowerCase()}>
      <SwimLaneGrid
        horses={horses}
        feeds={feeds}
        diet={diet}
        timeMode={effectiveTimeMode}
        isEditable={false}
      />
    </div>
  );
}
```

##### 4.4.2 Mobile Controller - Horses Tab (Home)

Searchable list of `<HorseCard />` components:

```tsx
// src/client/views/Controller/HorsesTab.tsx
export function HorsesTab() {
  const filteredHorses = computed(() => {
    const query = searchQuery.value.toLowerCase();
    return horses.value.filter(h => h.name.toLowerCase().includes(query));
  });

  return (
    <div class="horses-tab" data-testid="horses-tab">
      <input
        type="search"
        placeholder="Search horses..."
        data-testid="horse-search"
        onInput={(e) => searchQuery.value = e.currentTarget.value}
      />

      <div class="horse-list" data-testid="horse-list">
        {filteredHorses.value.map(horse => (
          <HorseCard
            key={horse.id}
            horse={horse}
            feedCount={countActiveFeeds(horse.id)}
            onClick={() => navigateToHorseDetail(horse.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

##### 4.4.3 Mobile Controller - Horse Detail View

Uses `<FeedPad />` for touch-friendly editing:

```tsx
// src/client/views/Controller/HorseDetail.tsx
export function HorseDetail({ horseId }: { horseId: string }) {
  const [selectedFeed, setSelectedFeed] = useState<{ feedId: string; field: 'amAmount' | 'pmAmount' } | null>(null);

  return (
    <div class="horse-detail" data-testid="horse-detail">
      <h2>{horse.value?.name}</h2>

      {/* Active feeds as large tappable tiles */}
      <div class="feed-tiles" data-testid="feed-tiles">
        {activeFeeds.value.map(feed => {
          const entry = dietByKey.value.get(`${horseId}:${feed.id}`);

          return (
            <div key={feed.id} class="feed-tile" data-testid={`feed-tile-${feed.id}`}>
              <div class="feed-tile-name">{feed.name}</div>
              <div class="feed-tile-values">
                {/* AM value */}
                <button
                  class="value-button"
                  data-testid={`feed-tile-am-${feed.id}`}
                  onClick={() => setSelectedFeed({ feedId: feed.id, field: 'amAmount' })}
                >
                  AM: {formatQuantity(entry?.amAmount, feed.unit) || '—'}
                </button>

                {/* PM value */}
                <button
                  class="value-button"
                  data-testid={`feed-tile-pm-${feed.id}`}
                  onClick={() => setSelectedFeed({ feedId: feed.id, field: 'pmAmount' })}
                >
                  PM: {formatQuantity(entry?.pmAmount, feed.unit) || '—'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FeedPad drawer for editing */}
      {selectedFeed && (
        <FeedPad
          isOpen={!!selectedFeed}
          currentValue={getCurrentValue(selectedFeed)}
          onValueChange={(value) => updateDiet(horseId, selectedFeed.feedId, selectedFeed.field, value)}
          onClose={() => setSelectedFeed(null)}
          feedName={getFeedName(selectedFeed.feedId)}
          unit={getFeedUnit(selectedFeed.feedId)}
        />
      )}
    </div>
  );
}
```

##### 4.4.4 Mobile Controller - Board Tab

Read-only scaled-down mirror of TV for verification:

```tsx
// src/client/views/Controller/BoardTab.tsx
export function BoardTab() {
  return (
    <div class="board-tab" data-testid="board-tab">
      <div class="board-label">TV Preview (Read-Only)</div>
      <div class="board-preview" style={{ transform: 'scale(0.6)', transformOrigin: 'top left' }}>
        <SwimLaneGrid
          horses={horses}
          feeds={feeds}
          diet={diet}
          timeMode={effectiveTimeMode}
          isEditable={false}
        />
      </div>
    </div>
  );
}
```

**Deliverables:**
- [x] Implement Display view (TV) using `<SwimLaneGrid />` with `isEditable={false}` (`src/client/views/Display.tsx`)
- [x] Implement HorsesTab with searchable `<HorseCard />` list (`src/client/views/Controller/HorsesTab.tsx`)
- [x] Implement HorseDetail view with large tappable feed tiles and `<FeedPad />` (`src/client/views/Controller/HorseDetail.tsx`)
- [x] Implement BoardTab as read-only scaled-down TV mirror (`src/client/views/Controller/BoardTab.tsx`)
- [x] Implement FeedsTab for feed management (`src/client/views/Controller/FeedsTab.tsx`)
- [x] Implement SettingsTab for display controls (`src/client/views/Controller/SettingsTab.tsx`)
- [x] Implement PWA with `vite-plugin-pwa` (`vite.config.ts`, `public/` icons)

#### 4.5 Test ID Strategy for E2E Migration ✅ COMPLETED

**Critical:** Old DOM structure (`.grid-cell`) will change significantly. All Playwright tests must migrate to `data-testid` selectors.

**Updated Test Selector Map:**

```typescript
// tests/e2e/selectors.ts
export const selectors = {
  // Grid (now SwimLaneGrid)
  swimLaneGrid: '[data-testid="swim-lane-grid"]',
  gridHeader: '[data-testid="grid-header"]',
  gridFooter: '[data-testid="grid-footer"]',

  // Cells and badges
  horseHeader: (id: string) => `[data-testid="horse-header-${id}"]`,
  feedRow: (id: string) => `[data-testid="feed-row-${id}"]`,
  feedName: (id: string) => `[data-testid="feed-name-${id}"]`,
  cell: (horseId: string, feedId: string) => `[data-testid="cell-${horseId}-${feedId}"]`,
  badge: (horseId: string, feedId: string) => `[data-testid="badge-${horseId}-${feedId}"]`,
  note: (id: string) => `[data-testid="note-${id}"]`,

  // FeedPad
  feedPad: '[data-testid="feed-pad"]',
  feedPadClose: '[data-testid="feed-pad-close"]',
  feedPadPresets: '[data-testid="feed-pad-presets"]',
  presetEmpty: '[data-testid="preset-empty"]',
  presetHalf: '[data-testid="preset-half"]',
  presetOne: '[data-testid="preset-one"]',
  presetTwo: '[data-testid="preset-two"]',
  feedPadStepper: '[data-testid="feed-pad-stepper"]',
  stepperDecrement: '[data-testid="stepper-decrement"]',
  stepperValue: '[data-testid="stepper-value"]',
  stepperIncrement: '[data-testid="stepper-increment"]',
  feedPadConfirm: '[data-testid="feed-pad-confirm"]',

  // HorseCard
  horseCard: (id: string) => `[data-testid="horse-card-${id}"]`,
  horseCardName: (id: string) => `[data-testid="horse-card-name-${id}"]`,
  horseCardSummary: (id: string) => `[data-testid="horse-card-summary-${id}"]`,

  // Horse Detail
  horseDetail: '[data-testid="horse-detail"]',
  feedTiles: '[data-testid="feed-tiles"]',
  feedTile: (id: string) => `[data-testid="feed-tile-${id}"]`,
  feedTileAM: (id: string) => `[data-testid="feed-tile-am-${id}"]`,
  feedTilePM: (id: string) => `[data-testid="feed-tile-pm-${id}"]`,

  // Navigation
  horsesTab: '[data-testid="horses-tab"]',
  horseSearch: '[data-testid="horse-search"]',
  horseList: '[data-testid="horse-list"]',
  boardTab: '[data-testid="board-tab"]',

  // Other
  timeMode: (mode: string) => `[data-testid="time-mode-${mode}"]`,
  pairingCode: '[data-testid="pairing-code"]',
};
```

**Migration Checklist for Playwright Tests:**

| Test File | Old Selector | New Selector | Status |
|-----------|--------------|--------------|--------|
| `display.spec.js` | `.grid-cell.header.horse-name` | `selectors.horseHeader(id)` | ⬜ Update |
| `display.spec.js` | `.grid-cell.value` | `selectors.cell(horseId, feedId)` | ⬜ Update |
| `display.spec.js` | `.grid-cell.feed-name` | `selectors.feedName(id)` | ⬜ Update |
| `display.spec.js` | `.grid-cell.note` | `selectors.note(id)` | ⬜ Update |
| `controller.spec.js` | `.grid-cell.value` (keypad) | `selectors.feedPad` + preset/stepper | ⬜ Update |
| `workflows.spec.js` | `.grid-cell.feed-name` | `selectors.feedName(id)` | ⬜ Update |
| `workflows.spec.js` | `.grid-cell.note` | `selectors.note(id)` | ⬜ Update |

**Deliverables:**
- [x] Create `tests/e2e/selectors.ts` with all `data-testid` mappings (COMPLETED)
- [ ] Update all Playwright tests to use new selectors (PENDING - Phase 5)
- [ ] Add new tests for `<FeedPad />` interaction flows (PENDING - Phase 5)
- [ ] Add new tests for `<HorseCard />` and Horse Detail view (PENDING - Phase 5)
- [ ] Add tests for vertical swim lane rendering (PENDING - Phase 5)
- [ ] Add tests for blank cell rendering (zero/null values) (PENDING - Phase 5)
- [ ] Verify all existing test scenarios pass with new component structure (PENDING - Phase 5)

---

### Phase 5: Test Hardening 📋 NOT STARTED

**Goal:** Update Playwright suite for new DOM structure and ensure feature parity.

**Status:** Waiting for remaining Phase 4 work (SSE, FeedsTab, SettingsTab) and ready to begin E2E test migration.

#### 5.1 Selector Migration

Create a test utilities file with stable selectors:

```typescript
// tests/e2e/selectors.ts
export const selectors = {
  grid: '[data-testid="feed-grid"]',
  horseHeader: (id: string) => `[data-testid="horse-header-${id}"]`,
  feedRow: (id: string) => `[data-testid="feed-row-${id}"]`,
  cell: (horseId: string, feedId: string) => `[data-testid="cell-${horseId}-${feedId}"]`,
  note: (id: string) => `[data-testid="note-${id}"]`,
  timeMode: (mode: string) => `[data-testid="time-mode-${mode}"]`,
  pairingCode: '[data-testid="pairing-code"]',
  codeInput: (index: number) => `[data-testid="code-input-${index}"]`,
  connectBtn: '[data-testid="connect-btn"]',
  quantityModal: '[data-testid="quantity-modal"]',
  quantityInput: '[data-testid="quantity-input"]',
};
```

#### 5.2 Feature Parity Checklist

| Feature | Test File | Status |
|---------|-----------|--------|
| Pairing flow | `workflows.spec.ts` | ⬜ Update |
| Grid rendering | `display.spec.ts` | ⬜ Update |
| Time mode switching | `display.spec.ts` | ⬜ Update |
| SSE real-time updates | `display.spec.ts` | ⬜ Update |
| Quantity editing | `controller.spec.ts` | ⬜ Update |
| Horse CRUD | `controller.spec.ts` | ⬜ Update |
| Feed CRUD | `controller.spec.ts` | ⬜ Update |
| Notes with expiry | `workflows.spec.ts` | ⬜ Update |
| Pagination | `display.spec.ts` | ⬜ Update |
| Zoom levels | `controller.spec.ts` | ⬜ Update |
| Reports calculation | `controller.spec.ts` | ⬜ Update |
| Error handling | `edge-cases.spec.ts` | ⬜ Update |
| Accessibility | `a11y.spec.ts` | ⬜ Update |

**Deliverables:**
- [x] Create `tests/e2e/selectors.ts` with all `data-testid` mappings (already completed in Phase 4.5)
- [ ] Update all E2E tests to use new selectors
- [ ] Add new tests for granular API endpoints
- [ ] Verify all existing test scenarios pass

---

## Future-Proofing

The V3 architecture lays foundations for planned features:

| Feature | Preparation |
|---------|-------------|
| **Inventory Management** | `feeds.stock_level`, `feeds.low_stock_threshold` columns |
| **Horse History/Archive** | `horses.archived` column, all `created_at`/`updated_at` timestamps |
| **Audit Log** | Timestamps on all tables enable change tracking |
| **Multiple Controllers** | Granular endpoints reduce conflict scope |
| **Offline Editing** | Signal-based state enables local-first sync |

---

## Migration Risk Mitigation

1. **Data Migration Script:** Create SQL script to transform JSON blobs to relational tables
2. **Feature Flag:** Add `V3_ENABLED` env var to toggle between old/new implementations during transition
3. **Parallel Running:** Run both systems simultaneously during validation phase
4. **Rollback Plan:** Keep `displays_v2_backup` table until migration is verified

---

## Success Criteria

**Completed:**
- [x] No JSON blobs in database (V3 schema uses normalized tables)
- [x] All validation uses Zod schemas (implemented in `src/shared/schemas/`)
- [x] Time mode logic in single shared file (`src/shared/time-mode.ts`)
- [x] Grid component reused across Display and Controller (`SwimLaneGrid` used in both Display and BoardTab)

**Pending:**
- [ ] All existing E2E tests pass with new selectors (Phase 5)
- [ ] API response times remain under 100ms (needs performance testing)
- [ ] Lighthouse PWA score > 90 (PWA configured, needs testing)

---

## Next Steps

To complete the V3 migration, the next agent should:

1. **Phase 4 is complete!** All components implemented:
   - ✅ FeedsTab for feed management (`src/client/views/Controller/FeedsTab.tsx`)
   - ✅ SettingsTab for display controls (`src/client/views/Controller/SettingsTab.tsx`)
   - ✅ SSE client for real-time updates (`src/client/services/sse.ts`)
   - ✅ PWA configured with `vite-plugin-pwa` (manifest, icons, workbox)

2. **Complete Phase 5 (Test Hardening):**
   - Migrate all E2E Playwright tests to use new `data-testid` selectors from `tests/e2e/selectors.ts`
   - Add new test cases for Phase 4 components (FeedPad, HorseCard, SwimLaneGrid, FeedCard)
   - Add test cases for FeedsTab and SettingsTab
   - Verify all existing test scenarios pass with new component structure
   - Run full test suite and fix any failures

3. **Integration Testing:**
   - Test SSE real-time synchronization between controller and display
   - Test PWA offline functionality and install experience
   - Verify theming transitions work smoothly
   - Test on actual mobile devices with "dirty hands" scenarios

**Reference Documentation:**
- `AGENTS.md` - Quick orientation and development practices
- `TECHNICAL_SPECIFICATION.md` - API endpoints and data formats
- `tests/e2e/selectors.ts` - Test selector definitions
