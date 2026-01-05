# Board UX Design

> A designer's notebook for the HorseBoard display system.

---

## The Core Insight

Feedrooms are physical spaces with real constraints. Dust, hay, and busy hands make phone interaction impractical. The TV mounted on the wall is the source of truth—big, bright, and readable from across the room. But the phone in your pocket is your escape hatch. When you're halfway to the hay shed and can't remember how many scoops Apollo needs, you pull it out and glance.

These two screens serve fundamentally different purposes:

| Screen | Purpose | Interaction | Environment |
|--------|---------|-------------|-------------|
| **TV (Board)** | Room-scale reference | Passive viewing | Wall-mounted, dusty, shared |
| **Phone (Controller)** | Personal quick-check | Active scrolling | In-pocket, clean, private |

The magic happens when they work together without fighting each other.

---

## Two Workflows, Two Worlds

### The Feed Workflow (Primary)

Most people feed by ingredient, not by horse. You grab the Oats bucket, walk down the stalls, and distribute scoops. Then you grab the Hay. Then the Vitamins.

This means **Feed-Major** orientation (feeds as columns) often makes more sense on screen:

```
         OATS    HAY    VITAMINS
Apollo    2       -        1
Bella     1       2        -
Charlie   -       3        1
```

You're scanning down the "Oats" column while holding the Oats bucket.

### The Horse Workflow (Secondary)

Some barns work differently—perhaps dealing with one horse at a time (vet checks, new intake, isolation). For them, **Horse-Major** orientation is natural:

```
         APOLLO  BELLA  CHARLIE
Oats       2       1        -
Hay        -       2        3
Vitamins   1       -        1
```

The key insight: **let users choose**. The orientation toggle should be a first-class control, not buried in settings.

---

## The Sparse Matrix Philosophy

A typical stable might have:
- 15-20 horses
- 25-30 different feeds/supplements

But most horses only eat 3-5 things. The diet matrix is **sparse**—90% empty cells.

Showing all 30 feed rows when only 4 are relevant to the horses on screen is visual clutter. Instead:

> **Only show feeds that have values for the currently visible horses.**

This transforms a cluttered 20x30 grid into a clean 6x4 grid that fits beautifully on any screen.

### The Algorithm

1. **Slice the primary axis** (e.g., 6 horses per page)
2. **Scan diets** for those 6 horses
3. **Filter secondary axis** to only feeds they actually eat
4. **Respect time mode** — if it's PM, hide AM-only feeds entirely

The result: every cell on screen is either filled or meaningfully empty (a horse that *could* eat this feed but doesn't right now).

---

## Pagination: The TV's Scroll

TVs don't scroll. They paginate.

### Page Controls

The phone becomes your TV remote. Big, chunky buttons:

```
┌─────────────────────────────────┐
│  TV DISPLAY                     │
│  ◀  Page  2 / 4  ▶             │
└─────────────────────────────────┘
```

Design considerations:
- **Touch targets**: At least 48px tall. Feedroom hands are often gloved.
- **Disabled states**: Grey out, don't hide. Users need to know they're at the edge.
- **Feedback**: The TV should update within 200ms. Any slower feels broken.

### Zoom = Density

The S / M / L zoom controls don't actually zoom text—they control **horses per page**:

| Zoom | Horses/Page | Use Case |
|------|-------------|----------|
| S (Small) | 8 | Small TV, close viewing |
| M (Medium) | 6 | Default, most barns |
| L (Large) | 4 | Big TV, far viewing, low-vision users |

This indirectly affects text size because fewer horses means more space per column.

### The Breadcrumb Promise

When data overflows (even after sparse filtering), the TV should never silently clip content. Instead:

```
┌────────────────────────────────────┐
│  OATS   HAY   BARLEY   VITAMINS    │
│  ...                               │
│  ↓ 3 more feeds below              │
└────────────────────────────────────┘
```

This breadcrumb tells the user: "There's more. Use your phone to page down."

---

## The Phone's Dual Personality

### Reference Mode (Default)

When you open the Board tab on your phone, you see everything:
- All horses (scrollable horizontally/vertically)
- All feeds
- Current time mode highlighted

No pagination. No clipping. Just a complete view you own.

This is your **board-in-the-pocket**. Private. Personal. Scroll at will.

### Remote Mode (Overlay)

At the top of the same screen, a compact control bar:

```
┌─────────────────────────────────┐
│ TV: Page 2/4   ◀ ▶   [⚙]      │
├─────────────────────────────────┤
│                                 │
│   [Your scrollable board here]  │
│                                 │
└─────────────────────────────────┘
```

The remote controls float above. They don't interrupt your personal reference view.

Tapping the gear (⚙) expands display settings:
- Time Mode: Auto / AM / PM
- Zoom: S / M / L
- Orientation: Horses / Feeds (Phase 2)

---

## Orientation Toggle (Phase 2)

### Visual Design

Two chunky buttons, mutually exclusive:

```
┌──────────────────────┐
│ ORIENTATION          │
│ ┌─────────┬────────┐ │
│ │ HORSES  │ FEEDS  │ │
│ │  ━━━    │  ║║║   │ │
│ └─────────┴────────┘ │
└──────────────────────┘
```

The icons show the visual difference:
- **Horses**: Horizontal stripes (zebra lanes going →)
- **Feeds**: Vertical stripes (columns going ↓)

### Behavioral Note

When switching orientation:
1. Reset to page 0 (avoid confusion)
2. Re-run sparse filter with new axis logic
3. Animate the transition (subtle 300ms crossfade)

---

## Time Mode & The AM/PM Split

Feeds often differ by time of day. Morning feeds include supplements; evening feeds are lighter.

### Display Behavior

The TV shows a prominent badge: **AM** or **PM**

In AUTO mode, this switches at noon. Some barns want 5am / 4pm splits—that's a future enhancement.

### Override Behavior

From the phone, tap AM or PM to force the display. The override lasts 1 hour, then reverts to AUTO.

**Why 1 hour?** Long enough to cover a feeding session. Short enough that you don't forget you set it and confuse evening staff.

### Sparse Filtering Integration

If a horse only eats a feed in PM and it's currently AM:
- That feed row **disappears** from the TV
- The phone reference shows all feeds (with AM column greyed out)

This prevents confusion: "Why is Vitamins not showing for Apollo?" Because Apollo doesn't get Vitamins in the morning.

---

## Edge Cases & Failovers

### Too Many Feeds (Vertical Overflow)

Even after sparse filtering, some pages might have 15+ feeds visible. If the TV can't fit them:

1. Show as many as fit
2. Add breadcrumb: "↓ 5 more below"
3. **2D Pagination** (Optional): Prev/Next cycles through feed "sub-pages" before advancing to next horse page

Design decision: Keep this simple in Phase 1. Just show the breadcrumb. Power users can scroll on their phone.

### Too Many Horses (Horizontal Overflow)

Already solved: that's what pagination is for.

### Empty Page

What if all horses on a page have no feeds in the current time mode?

Show a soft message:
```
┌────────────────────────────────────┐
│       No feeds scheduled           │
│        for AM on this page         │
└────────────────────────────────────┘
```

Don't show an empty grid—that's confusing.

### Horse Ordering

Horses should be orderable. Common patterns:
- **Barn location**: Stall 1, Stall 2, Stall 3...
- **Feed complexity**: Horses with most feeds first
- **Alphabetical**: Simple default

Phase 2 should add drag-drop reordering or a "sort by" dropdown.

### Dynamic Ordering (Clever But Optional)

Within a page, we could reorder horses by **relevance to visible feeds**:
- Page shows Feeds A, B, C
- Horse with all three goes first
- Horse with only C goes last

This clusters "busy" rows at the top. Might be confusing if order changes per page. Needs user testing.

---

## Visual Polish

### Transitions

When paging:
- **Crossfade**: 200ms opacity transition
- **Slide** (optional): Subtle 50px slide in page direction

Avoid jarring cuts. The TV is ambient; it shouldn't startle.

### Color & Theming

AM/PM can subtly tint the display:
- AM: Warm sunrise tones (soft oranges)
- PM: Cool dusk tones (soft blues)

This is already in the codebase (`data-theme`). Extend it for the sparse grid.

### Legibility at Distance

- **Minimum font size**: 1.5rem on TV (scales up with zoom)
- **High contrast**: Scoop badges should pop from background
- **Avoid thin fonts**: Use 600+ weight for numbers

---

## Testing Real Workflows

### Scenario 1: Morning Feed

Sarah enters the feedroom at 6am. The TV shows AM view, Page 1 (Apollo, Bella, Charlie). She grabs the Oats bucket (2kg), sees Apollo needs 2 scoops, Bella needs 1. She distributes. Reaches for Hay—it's on Page 2. She uses her phone to tap ▶. TV updates. She continues.

**Key**: Minimal phone interaction. One tap to page.

### Scenario 2: Quick Check Away from Room

Mike is in the pasture. He gets a call: "How much Bute does Dusty get?" He opens his phone, taps Board tab, scrolls to Dusty. Answers the call. Never touched the feedroom TV.

**Key**: Phone is independent reference. No sync weirdness.

### Scenario 3: New Horse Intake

A new horse arrives. Owner adds it via Controller, assigns feeds. Returns to feedroom. The TV doesn't automatically show the new horse (might be on a later page). But the phone's reference shows all horses—owner can page the TV to find it.

**Key**: SSE sync keeps data fresh; user controls what page TV shows.

---

## Open Questions for Phase 2

1. **Portrait vs Landscape detection**: Should the board auto-rotate orientation based on screen aspect ratio?

2. **Multi-board support**: Can one phone control multiple TVs (e.g., two feedrooms)?

3. **Accessibility**: Voice control for paging? ("Alexa, show next page")

4. **Print view**: Generate a PDF of the full matrix for barn records?

5. **Historical view**: "What did Apollo eat last Tuesday?" (Requires audit log)

---

## Summary

The Board UX is built on a simple principle:

> **The TV shows a slice. The phone shows everything.**

Pagination, sparse filtering, and orientation are all in service of making that slice as useful as possible for the person standing in the dusty feedroom, bucket in hand, glancing up at the wall.
