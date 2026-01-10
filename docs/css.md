# HorseBoard Design System

CSS architecture and design token reference.

## File Structure

| File | Purpose | Lines |
|------|---------|-------|
| [theme.css](file:///home/a/dev/horseboard/src/client/styles/theme.css) | Design tokens & theme variables | 70 |
| [base.css](file:///home/a/dev/horseboard/src/client/styles/base.css) | Resets & global elements | 19 |
| [utilities.css](file:///home/a/dev/horseboard/src/client/styles/utilities.css) | Composable utility classes | 120 |
| [components.css](file:///home/a/dev/horseboard/src/client/styles/components.css) | Shared components (buttons, cards, modals) | 398 |
| [views.css](file:///home/a/dev/horseboard/src/client/styles/views.css) | View-specific styles | 1174 |
| [SwimLaneGrid.css](file:///home/a/dev/horseboard/src/client/components/SwimLaneGrid/SwimLaneGrid.css) | TV grid component | 147 |

---

## 1. Design Tokens

### Color Themes

Two themes via `data-theme` attribute on Board view:

| Token | AM (Morning Mist) | PM (Tack Room) |
|-------|-------------------|----------------|
| `--color-bg-primary` | `#f8f9fa` (off-white) | `#2c2c2e` (dark grey) |
| `--color-bg-secondary` | `#e8ebe9` | `#3a3a3c` |
| `--color-text-primary` | `#2d4a3e` (hunter green) | `#f5a623` (amber) |
| `--color-text-secondary` | `#5a7a6b` | `#d4922a` |
| `--color-accent` | `#3d5a4d` | `#e09615` |
| `--color-swim-lane-alt` | `rgba(0,0,0,0.03)` | `rgba(0,0,0,0.15)` |

### Semantic Colors

```css
--color-danger: #e74c3c;
--color-danger-hover: rgba(231, 76, 60, 0.1);
```

### Spacing Scale

```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 0.75rem;   /* 12px */
--spacing-lg: 1rem;      /* 16px */
--spacing-xl: 1.5rem;    /* 24px */
--spacing-2xl: 2rem;     /* 32px */
```

### Sizing

```css
--touch-target: 48px;  /* Minimum touch target */
```

### Typography Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--font-size-xs` | 0.75rem (12px) | Badges, labels |
| `--font-size-sm` | 0.875rem (14px) | Meta, secondary text |
| `--font-size-base` | 1rem (16px) | Body, inputs |
| `--font-size-md` | 1.125rem (18px) | Emphasis |
| `--font-size-lg` | 1.25rem (20px) | Card titles |
| `--font-size-xl` | 1.5rem (24px) | Page titles |
| `--font-size-2xl` | 1.75rem (28px) | Hero headings |
| `--font-size-3xl` | 2rem (32px) | TV display |
| `--font-size-display` | 3rem (48px) | TV large display |

### Shadows

```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);   /* Subtle lift */
--shadow-md: 0 8px 32px rgba(0, 0, 0, 0.2);  /* Modal */
--shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.1); /* Card hover */
```

### Border Radius

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 999px;  /* Pills */
```

### Z-Index Layers

```css
--z-sticky: 100;   /* Tab bar, sticky headers */
--z-modal: 1000;   /* Modal overlays */
--z-overlay: 2000; /* FeedPad drawer */
```

### Transitions

```css
--transition-fast: 0.15s ease;
--transition-normal: 0.2s ease;
--transition-theme: 500ms ease;  /* Day/night transitions */
```

---

## 2. Typography

**Font Stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

| Element | Size | Weight |
|---------|------|--------|
| Page title (`auth-title`) | 1.75rem | 700 |
| Tab title | 1.5rem | 700 |
| Section title | 1rem | 700 |
| Modal title | 1.25rem | 700 |
| Body text | 1rem | 400/500 |
| Small/meta | 0.875rem | 400 |
| Tiny labels | 0.75rem | 600 |

**Monospace**: `'SF Mono', 'Menlo', monospace` for codes/values

**Numeric**: `font-variant-numeric: tabular-nums` for aligned numbers

---

## 3. Utility Classes

### Layout

| Class | Effect |
|-------|--------|
| `.u-flex-col` | `flex-direction: column` |
| `.u-flex-center` | Centered flex |
| `.u-flex-between` | `justify-content: space-between` |

### Spacing

| Class | Gap |
|-------|-----|
| `.u-gap-xs` | 0.25rem |
| `.u-gap-sm` | 0.5rem |
| `.u-gap-md` | 0.75rem |
| `.u-gap-lg` | 1rem |

### Touch

| Class | Effect |
|-------|--------|
| `.u-touch-target` | `min-height: 48px` |
| `.theme-transition` | Smooth bg/color transitions |

### Semantic Utilities

| Category | Classes |
|----------|---------|
| **Typography** | `.text-xs`, `.text-sm`, `.text-base`, `.text-md`, `.text-lg`, `.text-xl`, `.text-2xl` |
| **Font Weight** | `.font-medium` (500), `.font-semibold` (600), `.font-bold` (700) |
| **Interactive** | `.pressable` (scale on active), `.transition-fast` |
| **Shadows** | `.shadow-sm`, `.shadow-md`, `.shadow-lg` |
| **Inputs** | `.input-focus-ring` (transparent border → accent on focus) |

---

## 4. Button Variants

### Base Button

```css
button {
  padding: 0.75rem 1.5rem;
  min-height: 48px;
  font-weight: 600;
  border-radius: 8px;
  background: var(--color-accent);
  color: var(--color-bg-primary);
}
```

### Variants

| Class | Background | Color |
|-------|------------|-------|
| *(default)* | accent | bg-primary |
| `.btn-secondary` | bg-secondary | text-primary |
| `.btn-danger` | danger (10%) | #ef4444 |
| `.btn-text` | transparent | text-secondary |
| `.btn-outline` | transparent | accent (border: 2px solid accent) |

### Modifiers

| Class | Effect |
|-------|--------|
| `.btn-small` | Smaller padding, 0.875rem font |
| `.btn-block` | Full width |

### List Button (Settings)

Complex button with label + description, used in settings sections.

```css
.btn-list { padding: 1rem; border-radius: 12px; text-align: left; }
.btn-list.active { background: accent; color: bg-primary; }
.btn-list-primary { border-color: accent; }
.btn-list-danger { border-color: danger; color: danger; }
```

---

## 5. Form Components

### Input

```css
.input {
  padding: 0.875rem 1rem;
  min-height: 48px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: var(--color-bg-secondary);
}
.input:focus { border-color: var(--color-accent); }
```

### Code Input

```css
.input-code {
  font-family: monospace;
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 0.2em;
}
```

### Form Patterns
Consolidated auth and landing page styles.

```css
.form-view { display: flex; justify-content: center; min-height: 100vh; }
.form-card { padding: 2rem; border-radius: 16px; width: 100%; max-width: 400px; }
.form-stack { display: flex; flex-direction: column; gap: 1rem; }
.form-footer { margin-top: 1.5rem; text-align: center; color: text-secondary; }
.text-link { color: accent; font-weight: 600; }
```

### Segmented Controls
Unified pattern for toggle switches and unit selection.

```css
.segmented-control {
  display: flex;
  gap: var(--spacing-xs);
  padding: 0.25rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}
.segmented-control--invert { background: var(--color-bg-primary); }

.segment-btn {
  flex: 1;
  min-height: 40px;
  background: transparent;
  border: none;
  font-weight: 500;
  border-radius: var(--radius-sm);
}
.segment-btn.active {
  background: var(--color-accent);
  color: var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
}
```

### Switch Toggle

iOS-style switch for Match TV and similar toggles.

```css
.switch { width: 48px; height: 28px; }
.slider { border-radius: 34px; }
input:checked + .slider { background: var(--color-accent); }
```

---

## 6. Cards

### Base Card

```css
.card { background: bg-secondary; border-radius: 12px; padding: 1rem; }
```

### List Card (Horse/Feed items)

```css
.list-card {
  display: flex;
  min-height: 64px;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  cursor: pointer;
}
.list-card:active { transform: scale(0.98); }
```

Sub-elements: `.list-card-name`, `.list-card-meta`, `.list-card-badge`, `.list-card-action`, `.list-card-chevron`

---

## 7. Overlays & Modals

### Overlay Primitive
Shared backdrop for modals and drawers.

```css
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: var(--z-modal);
  opacity: 0; visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
}
.overlay--open { opacity: 1; visibility: visible; }
.overlay--darker { background: rgba(0,0,0,0.6); }
.overlay--drawer { z-index: var(--z-overlay); }
```

### Modal Card
```css
.modal-content {
  max-width: 400px;
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
```

---

## 8. Layout Patterns

### Tab Layout (Controller)

```css
.tab { padding: 1rem; padding-bottom: 5rem; overflow-y: auto; }
.tab-header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
.tab-title { font-size: 1.5rem; font-weight: 700; }
.tab-list { flex: 1; overflow-y: auto; }
```

### Tab Navigation (Bottom Bar)

```css
.controller-tabs {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
}
.tab-btn { flex-direction: column; gap: 0.25rem; font-size: 0.75rem; }
.tab-btn.active { color: var(--color-accent); }
```

### Section Pattern

```css
.section { margin-bottom: 2rem; }
.section-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; }
.section-description { font-size: 0.875rem; color: text-secondary; }
```

### Info Grid

```css
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.info-item { flex-direction: column; padding: 1rem; border-radius: 12px; }
.info-label { font-size: 0.75rem; text-transform: uppercase; }
.info-value { font-size: 1.25rem; font-weight: 700; font-family: monospace; }
```

---

## 9. Drawers

### Bottom Drawer Primitive
Slide-up drawer for FeedPad and TV Controls.

```css
.bottom-drawer {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--color-bg-secondary);
  border-radius: 16px 16px 0 0;
  padding: var(--spacing-xl);
  transform: translateY(100%);
  transition: transform 0.3s ease;
  z-index: var(--z-overlay);
}
.bottom-drawer--open { transform: translateY(0); }

/* Inline modifier (for sticky TV controls) */
.bottom-drawer--inline {
  position: sticky;
  transform: none;
  border-radius: 12px;
  z-index: auto;
}
```

---

## 10. TV Board View

### Theme Transitions

```css
.board-view { transition: background-color 500ms ease, color 500ms ease; }
```

### Badges

```css
.board-time-badge { padding: 0.5rem 1.5rem; font-size: 1.25rem; border-radius: 999px; }
.board-page-badge { background: bg-secondary; color: text-secondary; }
```

### SwimLaneGrid

Vertical zebra-striped grid for TV display.

```css
.swim-lane-primary { background: var(--color-bg-primary); }
.swim-lane-alt { background: var(--color-swim-lane-alt); }
.grid-header { border-bottom: 2px solid var(--color-accent); }
.horse-header { font-size: 1.125rem; font-weight: 700; }
.grid-cell { min-width: 100px; min-height: 60px; }
.scoop-badge { background: accent; border-radius: 8px; min-width: 48px; }
```

### Responsive (TV ≥1200px)

- Grid font-size: 1.25rem
- Headers: 1.5rem
- Cell min-width: 140px, min-height: 80px
- Badge font-size: 1.5rem

---

## 11. Responsive Breakpoints

| Breakpoint | Usage |
|------------|-------|
| `min-width: 768px` | Board preview scaling |
| `min-width: 1200px` | TV display optimizations |

---

## 12. Animation Patterns

| Pattern | Duration | Easing |
|---------|----------|--------|
| Button press | 0.1s | ease |
| Hover states | 0.15s | ease |
| Modal open | 0.2s | ease |
| Drawer slide | 0.3s | ease |
| Theme transition | 500ms | ease |

---

## 13. Accessibility

- **Touch targets**: Minimum 48px (`--touch-target`)
- **Focus states**: 2px accent border on inputs
- **Reduced motion**: Not yet implemented
- **Safe area insets**: `env(safe-area-inset-bottom)` on tab bar
