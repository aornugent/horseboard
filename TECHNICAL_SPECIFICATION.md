# Technical Specification: HorseBoard Behavioral Contract

## 1. System Purpose

HorseBoard is a feed management system for equine care. It displays feeding schedules on a stable TV and allows editing via a mobile controller.

**Core experience:** Update feeding quantities on your phone, see them instantly on the stable TV.

**Domain model:** Columns represent Horses, rows represent Feeds, and cells contain Quantities displayed as AM or PM values with units.

**Scoping:** One display equals one stable. All horses, feeds, and diet entries belong exclusively to that display. Creating a new display starts a fresh stable with no shared data.

---

## 2. Architecture Principles

The system comprises three components that share validation schemas and formatting logic:

- **TV Display:** A passive renderer that receives state and displays it. It never initiates edits.
- **Mobile Controller:** The command center where all editing occurs. It is a Progressive Web App optimized for offline-capable, touch-first interaction.
- **Backend Server:** Owns all business logic including ranking, time mode calculations, and scheduled data expiry. Persists data in a normalized relational database.

**Design principles:**
- The TV is a "dumb renderer" that receives state and renders it without transformation.
- The Controller is the sole interface for data modification.
- The Server is the single source of truth and enforces all business rules.
- Shared validation schemas prevent client-server drift.

---

## 3. Data Model

### 3.1 Display

A Display represents a stable instance and its settings.

**Fields:**
- Unique identifier (UUID)
- Six-digit pairing code (unique across all displays)
- Timezone (IANA format, e.g., "Australia/Sydney")
- Time mode: one of AUTO, AM, or PM
- Override expiry timestamp (nullable, ISO 8601)
- Zoom level: integer 1-3, determining horses per page (1=10, 2=7, 3=5)
- Current page index (zero-based)
- Creation and modification timestamps

**Constraints:**
- Pairing code must be exactly six digits and globally unique.
- Zoom level must be between 1 and 3 inclusive.

**Cascade behavior:** Deleting a display removes all associated horses, feeds, and diet entries.

### 3.2 Horse

A Horse belongs to exactly one display.

**Fields:**
- Unique identifier (UUID)
- Display reference (foreign key)
- Name (1-50 characters, unique within display)
- Note text (optional, max 200 characters)
- Note expiry timestamp (nullable, ISO 8601)
- Archived flag (reserved for future history feature)
- Creation and modification timestamps

**Constraints:**
- Name must be unique within the parent display.
- Note expiry is only meaningful when note text exists.

**Cascade behavior:** Deleting a horse removes all associated diet entries.

### 3.3 Feed

A Feed belongs to exactly one display.

**Fields:**
- Unique identifier (UUID)
- Display reference (foreign key)
- Name (1-50 characters, unique within display)
- Unit: one of scoop, ml, sachet, or biscuit
- Rank: non-negative integer (lower = more frequently used)
- Stock level (reserved for future inventory tracking)
- Low stock threshold (reserved for future alerts)
- Creation and modification timestamps

**Constraints:**
- Name must be unique within the parent display.
- Rank must be zero or positive.

**Cascade behavior:** Deleting a feed removes all associated diet entries.

### 3.4 Diet Entry

A Diet Entry links a Horse and a Feed with quantity values.

**Fields:**
- Horse reference (composite primary key)
- Feed reference (composite primary key)
- AM amount (nullable, 0-100)
- PM amount (nullable, 0-100)
- Creation and modification timestamps

**Constraints:**
- The combination of horse and feed must be unique (enforced composite primary key).
- Amounts must be between 0 and 100 inclusive when present.

**Value semantics:**
- A null amount means the feed is not assigned to the horse for that time slot.
- A zero amount means the horse deliberately receives none of this feed.
- Both null and zero display as blank and calculate as zero in reports.

**Cascade behavior:** Diet entries are automatically removed when either their parent horse or feed is deleted.

---

## 4. Business Logic Rules

### 4.1 Feed Ranking

Feeds are ranked by usage frequency to optimize the display order.

**Rule:** After any diet change, recalculate the rank for each feed as the count of distinct horses that receive a non-zero amount of that feed (either AM or PM). Feeds with more horses assigned receive lower rank numbers (rank 1 = most popular).

### 4.2 Time Mode Auto-Detection

The display shows either AM or PM values based on the current time mode.

**Rules:**
- When time mode is AUTO, determine the effective mode from the display's timezone:
  - Hours 04:00 through 11:59 local time resolve to AM.
  - Hours 12:00 through 03:59 local time resolve to PM.
- When time mode is AM or PM with an active override, use that mode until the override expires.
- When an override expires, automatically revert to AUTO mode.

**Override behavior:**
- Setting time mode to AM or PM creates an override that expires in one hour.
- Setting time mode to AUTO immediately clears any active override.
- The server checks for expired overrides every minute and broadcasts changes to connected clients.

### 4.3 Note Expiry

Horse notes can be set to auto-clear after a specified time.

**Rules:**
- When a note has an expiry timestamp and that timestamp passes, the server clears both the note text and expiry timestamp.
- The server checks for expired notes hourly.
- When a note expires, the change is broadcast to all connected clients.

### 4.4 Quantity Formatting

Quantities are displayed using fraction symbols for common values.

**Rules:**
- The fractions 0.25, 0.33, 0.5, 0.67, and 0.75 render as their Unicode equivalents (¼, ⅓, ½, ⅔, ¾).
- Whole numbers with fractional remainders combine (e.g., 1.5 displays as "1½").
- Values that don't match known fractions display as decimals with the unit suffix.
- Zero and null values render as completely blank cells (no dashes, no "0" text, no placeholders).

---

## 5. API Capabilities

### 5.1 Required Operations

The system must support these atomic operations:

**Display lifecycle:**
- Create a new display, returning its identifier and generated pairing code.
- Update display settings (timezone, zoom level, current page).
- Delete a display and cascade to all child data.

**Entity management:**
- Create, update, and delete horses within a display.
- Create, update, and delete feeds within a display.

**Diet management:**
- Atomic upsert of diet entries: if an entry exists, update it; if not, create it; if both amounts become null, delete it.
- All diet changes within a single request must succeed or fail together (transaction).

**Time mode control:**
- Set time mode with automatic override expiry calculation.

**Pairing:**
- Validate a six-digit pairing code and return the associated display identifier.

**Bootstrap:**
- Retrieve complete display state (settings, all horses, all feeds, all diet entries) in a single request for client initialization.

### 5.2 Validation Requirements

All input must be validated using shared schemas between client and server:

- Pairing codes must be exactly six digits.
- Names must be 1-50 characters.
- Notes must not exceed 200 characters.
- Amounts must be between 0 and 100 when present.
- Units must be one of the allowed values.
- Timestamps must be valid ISO 8601 format.

Validation errors must return structured feedback identifying which fields failed and why.

### 5.3 Real-Time Broadcasting

The system must support Server-Sent Events (SSE) for real-time updates.

**Connection lifecycle:**
- Upon connection, immediately send the complete bootstrap state.
- Send keepalive comments every 30 seconds to prevent connection timeout.

**Event types:**
- Bootstrap: full state on initial connection.
- Settings: when display settings change.
- Horses: when horses are added, modified, or deleted.
- Feeds: when feeds are added, modified, or deleted.
- Diet: when diet entries change.

**Reconnection:** Clients must implement exponential backoff (1s, 2s, 4s, 8s, up to 30s maximum) when connections fail.

---

## 6. UI/UX Contracts

### 6.1 TV Display Behaviors

**Layout:**
- Render as a CSS grid with horses as columns and feeds as rows.
- Apply vertical swim lanes: every second horse column has a slightly darker background to aid vertical scanning.
- Only show feeds that have at least one non-zero value across visible horses.
- Header row displays horse names; footer row displays horse notes.

**Pagination:**
- Zoom level determines horses per page (level 1=10, level 2=7, level 3=5).
- Current page index determines which horses are visible.

**Visual rendering:**
- Values appear inside rounded badge containers.
- Zero and null values render as completely blank cells to create recognizable "shape patterns" for diets.
- Theme transitions between AM and PM use slow CSS transitions (3 seconds) for a calming aesthetic.

**Pairing state:**
- Display the six-digit pairing code prominently until data arrives.
- Show a "Connection Lost" overlay during SSE disconnection.

### 6.2 Mobile Controller Behaviors

**Navigation:**
- Bottom tab bar with four tabs: Horses, Feeds, Board, Settings.
- All touch targets must be at least 48 pixels for "dirty hands" use.

**Horses Tab (home):**
- Display a searchable list of status cards, one per horse.
- Each card shows the horse name (large, bold) and a feed count summary pill.
- Tapping a card navigates to the horse detail view.
- Search filters horses by name in real-time.

**Horse Detail View:**
- Display large tappable tiles for each active feed assigned to the horse.
- Each tile shows the feed name and current AM/PM quantity.
- Tapping a quantity value opens the Feed Pad.

**Feed Pad:**
- A custom slide-up drawer that replaces the system keyboard for numeric input.
- Must never trigger the system keyboard.
- First row: preset buttons for Empty, ½, 1, and 2.
- Second row: stepper with minus button, current value display, and plus button.
- Stepper increments and decrements in 0.25 steps.
- All buttons must be at least 48 pixels.

**Feeds Tab:**
- List all feeds with options to create, rename, and delete.
- Unit selection from the allowed values.
- Delete requires confirmation (warns about cascade to diet entries).

**Board Tab:**
- A scaled-down, read-only mirror of the TV display.
- For verification only; no editing capability.
- Shows the same grid layout with vertical swim lanes.

**Settings Tab:**
- Time mode toggle: AM, PM, or AUTO.
- Zoom level selector: 1, 2, or 3.
- Timezone picker.
- Unpair button to disconnect from current display.

### 6.3 Status Indicators

**Controller sync status:** Display one of Ready, Saving, Saved, or Error to indicate current state.

**Form validation:** Highlight fields with inline error messages when validation fails.

**Network errors:** Display toast notifications for transient failures.

---

## 7. Error Handling Contracts

### 7.1 Response Expectations

- Successful reads return status 200.
- Successful creates return status 201.
- Validation failures return status 400 with structured field errors.
- Missing resources return status 404.
- Server errors return status 500.

All error responses must include a human-readable message and, for validation errors, a details object with field-level error arrays.

### 7.2 Client Resilience

**TV Display:**
- SSE disconnection triggers a visible overlay.
- Reconnection uses exponential backoff.
- Overlay auto-hides when connection restores.

**Mobile Controller:**
- Network failures show toast notifications.
- Optimistic updates with rollback on failure are acceptable.
- Form errors highlight affected fields inline.

---

## 8. Configuration

The server requires these environment settings:

- Server port (default: 3000)
- Database file path (default: ./data/horseboard.db)
- Environment mode (development or production)

---

## 9. Future Extension Points

The data model includes reserved fields for planned features:

- **Inventory tracking:** Stock level and low stock threshold fields on feeds.
- **Horse history:** Archived flag and timestamps on horses.
- **Audit logging:** Creation and modification timestamps on all entities.
- **Offline editing:** Signal-based state architecture enables local-first patterns.
- **Multiple controllers:** Granular endpoints reduce conflict scope.
- **User authentication:** Display ownership can be extended via user foreign key.
