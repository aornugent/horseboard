# HorseBoard UX Specification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (SSE)                              │
│   - Stores board state (orientation, zoom, page, time_mode)      │
│   - Broadcasts changes to all connected clients                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────┐
│   TV DISPLAY        │           │   CONTROLLER        │
│   /board            │           │   /controller       │
│                     │           │                     │
│ • Read-only         │  ◀──SSE──▶│ • Touch input       │
│ • No input          │           │ • Scrollable grid   │
│ • Paginated         │           │ • TV Controls       │
│ • Server-driven     │           │ • "Match TV" sync   │
└─────────────────────┘           └─────────────────────┘
```

---

## Controller Views

### BoardTab (First-Class View)

**Purpose:** Provide mobile users a complete, scrollable view of the entire board.

| Aspect | Behavior |
|--------|----------|
| **Grid** | Full board, unpaginated, touch-scrollable |
| **Orientation** | Independent toggle (header button) |
| **Time Mode** | Independent toggle (header button) |
| **Match TV** | Optional sync—when enabled, controller mirrors TV state |

> [!IMPORTANT]
> BoardTab is NOT a "preview"—it's the primary way users view the board on mobile, especially away from a TV display.

### TV Controls Drawer

**Purpose:** Remote control for the TV display. Changes here affect the TV, not the local controller view.

| Control | Effect |
|---------|--------|
| **Match TV Toggle** | Syncs controller view to TV state |
| **Orientation** | Changes TV display orientation |
| **Time Mode** | Overrides TV display AM/PM (temporary) |
| **Zoom** | Changes TV display zoom level |
| **Page (◀▶)** | Changes TV display page |

---

## Defaults vs Overrides

| Concept | Location | Scope | Persistence |
|---------|----------|-------|-------------|
| **Defaults** | SettingsTab → Display Defaults | Stored in DB | Permanent |
| **Overrides** | BoardTab → TV Controls Drawer | Applied via API | Temporary (1 hour) |

- **Defaults** configure what the TV shows when no override is active
- **Overrides** are temporary adjustments made from the controller

---

## Match TV Behavior

```
Match TV OFF (default):
┌─────────────┐        ┌─────────────┐
│ Controller  │        │ TV Display  │
│ AM, Page 1  │  ≠     │ PM, Page 3  │
│ Independent │        │ Server-sync │
└─────────────┘        └─────────────┘

Match TV ON:
┌─────────────┐        ┌─────────────┐
│ Controller  │   =    │ TV Display  │
│ PM, Page 3  │◀──────▶│ PM, Page 3  │
│ Synced      │        │ Server-sync │
└─────────────┘        └─────────────┘
```

When Match TV is enabled:
1. Controller reads page/orientation/time from server state
2. Changes in TV Controls Drawer update both controller AND TV
3. Header controls (AM/PM, orientation) become hidden

---

## Button Design Principles

### Constraints
- **Limited space** — mobile screens, often used one-handed
- **Harsh environment** — dusty feed rooms, gloved hands, quick glances
- **Mixed expertise** — owners configure rarely, staff use daily

### 1. Teach Through Design

| Principle | Implementation |
|-----------|----------------|
| **Progressive disclosure** | Show essential controls first; advanced in drawer |
| **Visual affordances** | Buttons look tappable; toggles show state clearly |
| **Contextual hints** | Tooltip on first use, then fade |
| **Consistent iconography** | ⇄ = flip, ▶ = next, ⚙️ = settings |

```
First Visit:
┌──────────────────────────────────┐
│ Board                    [AM] [⇄]│
│ ┌────────────────────────────────│
│ │ Tap AM/PM to switch time mode  │ ← Tooltip (dismisses after tap)
│ └────────────────────────────────│
└──────────────────────────────────┘
```

### 2. Learn Patterns Easily

**Segmented controls** for mutually exclusive options:
```
┌─────────────────────────────┐
│ [Auto]  [AM]  [PM]          │  ← One active, tap to switch
└─────────────────────────────┘
```

**Toggle switches** for on/off states:
```
┌─────────────────────────────┐
│ ○───────● Match TV Display  │  ← Familiar mobile pattern
└─────────────────────────────┘
```

**Icon buttons** for frequent actions:
```
[AM]  [⇄]   ← Compact, learnable, always visible in header
```

### 3. Create Joy

| Technique | Effect |
|-----------|--------|
| **Micro-animations** | Button press scales (0.98), toggle slides smoothly |
| **Theme transitions** | AM→PM crossfades background (500ms) |
| **Success states** | Brief flash when sync completes |


### Button Hierarchy

| Level | Style | Usage |
|-------|-------|-------|
| **Primary** | Solid accent color | Main action (Confirm, Save) |
| **Secondary** | Outlined/muted | Alternative action |
| **Tertiary** | Text only | Cancel, dismiss |
| **Icon** | 48px touch target | Header controls, frequent actions |
| **Segmented** | Grouped buttons | Mode selection (AM/PM, Horses/Feeds) |

### Touch Targets

```
Minimum: 48 × 48px
Recommended: 56 × 56px for primary actions
Spacing: ≥8px between adjacent targets
```

