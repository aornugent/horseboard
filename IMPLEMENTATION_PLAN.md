# Implementation Plan

## Current State

Phase 1 is complete:
- Express server with SQLite persistence
- Display CRUD API with pairing
- SSE for real-time updates
- Domain data model (feeds, horses, diet)
- Feed ranking based on usage
- Cascade cleanup of orphaned diet entries
- Timezone-aware AM/PM time mode with override expiry
- Automatic note expiry with hourly checks
- TV display app (pairing + table rendering)
- Mobile controller PWA (pairing + generic table editor)
- 113 automated tests passing

## What's Next

Transform the generic table editor into a domain-specific feed management system.

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

## Phase 2: TV Feed Grid

### 2.1 Grid Layout

**Tasks:**
- [ ] Refactor to CSS Grid layout
- [ ] Horses as columns, feeds as rows
- [ ] Dynamic column count based on zoom level
- [ ] Notes as footer row
- [ ] Only show feeds with non-zero values

### 2.2 Value Formatting

**Tasks:**
- [ ] Create fraction utility (0.5 → ½, 0.25 → ¼, etc.)
- [ ] Show AM or PM values based on time mode
- [ ] Blank for 0/null (preserve row height)

### 2.3 Pagination

**Tasks:**
- [ ] Implement page slicing based on zoom level
- [ ] Show current page indicator

---

## Phase 3: Mobile Controller Redesign

### 3.1 Tab Navigation

**Tasks:**
- [ ] Add tab bar: [Board] [Horses] [Feeds] [Reports]
- [ ] Persist current tab in session

### 3.2 Board Tab

**Tasks:**
- [ ] Mirror TV grid layout
- [ ] Tap cell → numeric keypad popover
- [ ] Tap horse name → open horse detail
- [ ] Tap note → edit note text
- [ ] AM/PM/AUTO toggle
- [ ] Zoom controls [-] [+]
- [ ] Pagination controls

### 3.3 Horses Tab

**Tasks:**
- [ ] Horse list view (cards)
- [ ] Horse detail modal:
  - [ ] Clone diet dropdown (copy from another horse)
  - [ ] Notes field with expiry toggle (None, 24h, 48h)
  - [ ] Stale note warning (>24h without expiry)
  - [ ] Active feeds section (editable)
  - [ ] Inactive feeds section (tap to add)
- [ ] Numeric input with step="0.25"

### 3.4 Feeds Tab

**Tasks:**
- [ ] Create/rename/delete feeds
- [ ] Set unit (Scoop, ml, Biscuit, Sachet)
- [ ] Cascade delete confirmation

### 3.5 Reports Tab

**Tasks:**
- [ ] Calculate weekly consumption per feed
- [ ] Display table: Feed | Weekly | Unit
- [ ] Round to 2 decimal places

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
