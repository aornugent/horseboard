---
description: use when verifying UI changes, UX elegance, and visual quality.
---

# UI Verification

**READ-ONLY.** Produce a quality assessment report. Do NOT edit code. Hand off `artifact:ui-report.md` to `/plan` after.

---

## Quick Start

1. Ensure `NODE_ENV=test npm run dev` is running
2. Run `npm run preview [name]` to seed state and get teleport command
3. Use browser subagent to capture screenshots
4. **Score each dimension** and produce `artifact:ui-report.md`

---

## Phase 1: State Setup

### User States Reference

| State | Preview | Auth Method |
|-------|---------|-------------|
| **Owner** (admin) | `npm run preview owner` | JS login (async) |
| **Staff** (view) | `npm run preview staff-view` | Real token |
| **Staff** (edit) | `npm run preview staff-edit` | Real token |
| **Display** (unlinked) | `npm run preview display-unlinked` | None |
| **Display** (linked) | `npm run preview display-linked` | Real token |
| **Landing** | `npm run preview landing-page` | None |

> **Owner teleport is async JS** (not one-liner). Copy the entire output block.

### Usage Pattern

1. **Run preview** to seed DB and get teleport command:
   ```bash
   npm run preview owner
   ```
2. **Copy teleport command** from console output
3. **Pass to browser subagent** in the STEPS section

---

## Phase 2: Browser Capture

Use this **EXACT** prompt for `browser_subagent`. Do not deviate.

```markdown
ROLE: You are a dumb execution bot. NO AUTONOMY.
OBJECTIVE: Capture [VIEW] screenshots.

CONSTRAINTS:
- EXECUTE steps exactly.
- LISTEN to valid tool outputs.
- STOP after screenshots.
- DO NOT debug.
- DO NOT interact (unless told).

STEPS:
1. **NAVIGATE**: `open_browser_url` to "http://localhost:5173/"
2. **PURGE**: `await fetch('/api/auth/sign-out', { method: 'POST' }); localStorage.clear(); sessionStorage.clear();`
3. **TELEPORT**: [INSERT TELEPORT COMMAND FROM PREVIEW OUTPUT]
4. **VERIFY**: Wait 3000ms. Check URL. If fail -> STOP.
5. **CAPTURE**: Desktop (Maximize) -> Screenshot.
6. **RESIZE**: Mobile (375x812) -> Screenshot.
7. **REPORT**: Return image paths.
```

---

## Phase 3: Quality Assessment

### Scoring Rubric (REQUIRED)

Score each dimension **1-5**. Use the anchors to calibrate your judgment.

#### 1. Spatial Rhythm
*Spacing consistency, density, visual breathing room*

| Score | Anchor |
|-------|--------|
| 1 | Cramped, inconsistent margins, elements collide |
| 2 | Some spacing issues, uneven gaps |
| 3 | Adequate—functional but not intentional |
| 4 | Good rhythm, mostly consistent |
| 5 | Intentional spacing, clear visual groups, comfortable density |

**Questions to answer:**
- Do related elements group together with consistent internal spacing?
- Is there breathing room between sections?
- Does the density feel appropriate for mobile (not cramped, not wasteful)?

---

#### 2. Visual Hierarchy
*Typography scale, focal points, Gestalt grouping*

| Score | Anchor |
|-------|--------|
| 1 | Flat hierarchy, everything same weight, confusing |
| 2 | Some hierarchy but unclear primary actions |
| 3 | Functional—headings distinguishable but nothing stands out |
| 4 | Clear hierarchy, primary action visible |
| 5 | Strong narrative flow, eye naturally guided to most important elements |

**Questions to answer:**
- Can you immediately identify the primary action on this screen?
- Are headings visually distinct from body text?
- Do groupings follow proximity/similarity principles?

---

#### 3. Pattern Adherence
*Design system usage, token compliance*

| Score | Anchor |
|-------|--------|
| 1 | Unstyled elements, browser defaults visible, Times New Roman |
| 2 | Some patterns but inconsistent, hardcoded values evident |
| 3 | Uses design system but with gaps (missing hover states, etc.) |
| 4 | Consistent pattern usage, few gaps |
| 5 | Full token/component use, no hardcoded values, all states present |

**Pattern Audit (REQUIRED):**
Before scoring, list:
- **Used patterns**: Which `.card`, `.btn-*`, `.section`, utility classes are visible?
- **Missing patterns**: What elements appear unstyled or use ad-hoc CSS?
- **Token violations**: Any hardcoded colors, pixels instead of spacing tokens?

---

#### 4. Responsive Fitness
*Mobile-first, touch targets, scroll depth*

| Score | Anchor |
|-------|--------|
| 1 | Layout broken, elements overflow, unusable |
| 2 | Functional but cramped, tap targets too small |
| 3 | Works on mobile but not optimized (horizontal scroll, tiny text) |
| 4 | Good mobile layout, appropriate stacking |
| 5 | Excellent—feels native to mobile, smart use of limited space |

**Questions to answer:**
- Are touch targets ≥48px?
- How many taps to reach the primary action?
- Is critical content above the fold?
- Are form fields stacked vertically with sufficient spacing?

---

#### 5. Polish & Craft
*Shadows, transitions, empty states, hover/focus*

| Score | Anchor |
|-------|--------|
| 1 | Wireframe feel, no depth, no interactivity feedback |
| 2 | Minimal polish, some missing states |
| 3 | Functional—has some polish but feels unfinished |
| 4 | Good—depth, transitions, most states present |
| 5 | Feels complete and intentional, delightful micro-interactions |

**Questions to answer:**
- First impression: does this look like a finished product or a prototype?
- Are empty states helpful or just blank?
- Do interactive elements have visible hover/focus states?

---

### Scoring Enforcement

**Pass Threshold:** All dimensions must score ≥3. Any dimension ≤2 is a **blocking issue**.

---

## Phase 4: Design System Reference

### Token Usage
Source of truth: `src/client/styles/theme.css`
- Colors: `--color-bg-primary`, `--color-accent`, etc.
- Spacing: `--spacing-xs` through `--spacing-2xl`
- Radii: `--radius-sm` through `--radius-full`

### Existing Patterns
Check `src/client/styles/styles.css`:
- **Buttons:** `.btn-secondary`, `.btn-danger`, `.btn-text`, `.btn-small`, `.btn-block`
- **List Buttons:** `.btn-list`, `.btn-list-primary`, `.btn-list-danger`
- **Inputs:** `.input`, `.input-code`
- **Cards:** `.card`, `.list-card`
- **Layout:** `.u-flex-col`, `.u-flex-center`, `.u-gap-*`
- **Sections:** `.section`, `.section-title`, `.section-description`

---

## Required Artifact

```markdown
# UI Verification Report: [View Name]

**URL:** [path]
**Date:** [timestamp]
**Viewports:** Desktop, Mobile (375×812)

## Screenshots
![Desktop](desktop.png)
![Mobile](mobile.png)

## Dimension Scores

| Dimension | Score | Notes |
|-----------|-------|-------|
| Spatial Rhythm | X/5 | ... |
| Visual Hierarchy | X/5 | ... |
| Pattern Adherence | X/5 | ... |
| Responsive Fitness | X/5 | ... |
| Polish & Craft | X/5 | ... |

**Overall:** [PASS/FAIL] (≤2 in any dimension = FAIL)

## Pattern Audit
- **Used:** `.card`, `.btn-list`, ...
- **Missing:** unstyled `<select>`, ...
- **Token violations:** hardcoded `#fff` in ...

## 🚨 Blocking Issues (Score ≤2)
| Dimension | Issue | Recommendation |
|-----------|-------|----------------|
| ... | ... | ... |

## ⚠️ Improvements (Score 3-4)
| Dimension | Issue | Suggestion |
|-----------|-------|------------|
| ... | ... | ... |

## ✅ Strengths (Score 5)
- ...

## Next Steps
> Run `/plan` with this report to implement fixes.
```

---

## Hard Rules

1. **Isolation:** ALWAYS `fetch('/api/auth/sign-out')` then `localStorage.clear()` before teleport.
2. **No Click-Ops:** Use teleport for setup. Only click for navigation (e.g. tabs).
3. **Subagent Scope:** Data capture ONLY. The outer agent (you) does the critique.
4. **Score Every Dimension:** Do not skip dimensions. Anchor your scores.
5. **Pattern Audit Required:** List used/missing patterns before scoring Pattern Adherence.

## Anti-Patterns

❌ Skipping dimensions or not providing scores
❌ Vague critiques ("looks broken" vs "score 2: cramped spacing in Account section")
❌ Passing views with ≤2 scores
❌ Subagent analyzing or suggesting code
