# Implementation Plan

## Current State

Phase 1, Phase 2, and Phase 3 are complete:
- Express server with SQLite persistence
- Display CRUD API with pairing
- SSE for real-time updates
- Domain data model (feeds, horses, diet)
- Feed ranking based on usage
- Cascade cleanup of orphaned diet entries
- Timezone-aware AM/PM time mode with override expiry
- Automatic note expiry with hourly checks
- TV display app with CSS Grid feed grid (horses as columns, feeds as rows)
- Fraction display (0.5 → ½, 0.25 → ¼, etc.)
- Time mode AM/PM value display with time indicator
- Pagination based on zoom level (1=10, 2=7, 3=5 horses per page)
- Notes footer row display
- Mobile controller PWA with domain-specific UI:
  - Tab navigation (Board, Horses, Feeds, Reports)
  - Board tab with grid, time mode toggle, zoom, pagination
  - Horses tab with list, detail modal, feed management
  - Feeds tab with create/rename/delete, unit selection
  - Reports tab with weekly consumption calculation
- Session tab persistence
- 113 automated tests passing

## What's Next

Phase 4: Polish (error handling, UX improvements, sync status)

---

## Phase 1: Domain Data Model ✓

### 1.1 Update Data Schema ✓

Migrate `table_data` from generic headers/rows to domain structure:

```json
{
  "settings": { "timezone", "timeMode", "overrideUntil", "zoomLevel", "currentPage" },
  "feeds": [{ "id", "name", "unit", "rank" }],
  "horses": [{ "id", "name", "note", "noteExpiry", "noteCreatedAt" }],
  "diet": { "horseId": { "feedId": { "am", "pm" } } }
}
```

**Tasks:**
- [x] Update validation in `PUT /api/displays/:id`
- [x] Add server-side feed ranking on save
- [x] Add cascade cleanup (remove orphaned diet entries)
- [x] Initialize new displays with empty domain structure
- [x] Add tests for new validation and processing

### 1.2 Time Mode Logic ✓

**Tasks:**
- [x] Add timezone-aware AM/PM detection
- [x] Implement override expiry (1 hour timeout)
- [x] Add minute-interval check for override expiry
- [x] Broadcast state changes via SSE
- [x] Add tests

### 1.3 Note Expiry ✓

**Tasks:**
- [x] Implement hourly check per display
- [x] Clear expired notes and broadcast
- [x] Add tests

---

## Phase 2: TV Feed Grid ✓

### 2.1 Grid Layout ✓

**Tasks:**
- [x] Refactor to CSS Grid layout
- [x] Horses as columns, feeds as rows
- [x] Dynamic column count based on zoom level
- [x] Notes as footer row
- [x] Only show feeds with non-zero values

### 2.2 Value Formatting ✓

**Tasks:**
- [x] Create fraction utility (0.5 → ½, 0.25 → ¼, etc.)
- [x] Show AM or PM values based on time mode
- [x] Blank for 0/null (preserve row height)

### 2.3 Pagination ✓

**Tasks:**
- [x] Implement page slicing based on zoom level
- [x] Show current page indicator

---

## Phase 3: Mobile Controller Redesign ✓

### 3.1 Tab Navigation ✓

**Tasks:**
- [x] Add tab bar: [Board] [Horses] [Feeds] [Reports]
- [x] Persist current tab in session

### 3.2 Board Tab ✓

**Tasks:**
- [x] Mirror TV grid layout
- [x] Tap cell → numeric keypad popover
- [x] Tap horse name → open horse detail
- [x] Tap note → edit note text
- [x] AM/PM/AUTO toggle
- [x] Zoom controls [-] [+]
- [x] Pagination controls

### 3.3 Horses Tab ✓

**Tasks:**
- [x] Horse list view (cards)
- [x] Horse detail modal:
  - [x] Clone diet dropdown (copy from another horse)
  - [x] Notes field with expiry toggle (None, 24h, 48h)
  - [x] Stale note warning (>24h without expiry)
  - [x] Active feeds section (editable)
  - [x] Inactive feeds section (tap to add)
- [x] Numeric input with step="0.25"

### 3.4 Feeds Tab ✓

**Tasks:**
- [x] Create/rename/delete feeds
- [x] Set unit (Scoop, ml, Biscuit, Sachet)
- [x] Cascade delete confirmation

### 3.5 Reports Tab ✓

**Tasks:**
- [x] Calculate weekly consumption per feed
- [x] Display table: Feed | Weekly | Unit
- [x] Round to 2 decimal places

---

## Phase 4: Polish

### 4.1 Error Handling

**Tasks:**
- [ ] TV: "Connection lost" overlay with retry
- [ ] Mobile: Network error notifications
- [ ] Mobile: Sync status indicator

### 4.2 UX

**Tasks:**
- [ ] TV: Smooth transitions
- [ ] TV: Auto-reconnect SSE
- [ ] Mobile: Debounce saves
- [ ] Timezone selector in settings

---

## Testing Additions

| Suite | Description |
|-------|-------------|
| Domain validation | Feed/horse/diet structure |
| Feed ranking | Usage-based rank calculation |
| Time mode | AM/PM detection, override expiry |
| Note expiry | Hourly cleanup |
| Reports | Weekly consumption calculation |

---

## Manual Testing Checklist

1. [ ] Start server, open `/display` on TV
2. [ ] Open `/controller` on phone, pair
3. [ ] Add horses and feeds
4. [ ] Set diet quantities (AM/PM)
5. [ ] Verify TV updates in real-time
6. [ ] Test AM/PM toggle and auto-detection
7. [ ] Test zoom and pagination
8. [ ] Add note with 24h expiry, verify it clears
9. [ ] Delete a feed, verify diet entries removed
10. [ ] Check reports show correct weekly totals
