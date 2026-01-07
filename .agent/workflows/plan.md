---
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write **test-led** implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Occams Razor. Deletion over addition. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the /plan workflow to create the implementation plan."

**Context:** This should be run after the /brainstorm workflow has produced a design in `artifact:brainstorm.md`

**Save plans to:** `artifact:implementation-plan.md`

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> REQUIRED NEXT STEP: Use the /executing workflow to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Design Invariants (Must Hold After Implementation):**
- [Invariant 1]
- [Invariant 2]
- [Invariant 3]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
## Invalidated or Removed Behavior

List any existing behavior, code paths, or tests that are no longer valid under this design.

For each:
- What previously worked?
- Why it is now incorrect or obsolete?
- How this will be enforced (test removal or new failing test)

## Coverage Matrix

List all meaningful variants of the feature and where they are tested.

| Variant / Case | Unit Test | Integration Test | E2E Test |
|----------------|-----------|------------------|----------|
| Case A         | ✅        | ✅               | ❌       |
| Case B         | ✅        | ❌               | ❌       |

All primary variants must have test coverage. Gaps must be explicitly justified.

## Task Structure

Include this once per plan:
**Specification Levels**

- **Locked**  
  The final shape is fully specified in the plan.  
  Do not invent structure, behavior, or naming.  
  Deviations require returning to /plan.

- **Constrained**  
  The plan intentionally leaves gaps.  
  You must complete the implementation, but only to satisfy the stated constraints  
  (tests, signatures, invariants). No new concepts or abstractions.

- **Mechanical**  
  Follow the steps exactly.  
  No design or interpretation required.


### Task N: [Component / Feature Name]

**Specification Level:** [Final | Test-Specified | Procedural]

**Intent:** Why this task exists and what must not change.

**Files:**
* Create: ...
* Modify: ...
* Test: ...



---

### Step 1: Write the failing test

```ts
import { test, expect } from "@playwright/test";
import { functionUnderTest } from "../../../src/exact/path/to/file";

test("specific behavior", async () => {
  const result = await functionUnderTest(input);
  expect(result).toBe(expected);
});
```

Notes:

* Prefer **one assertion per test**
* Import the function/component explicitly (even if it doesn’t exist yet)
* Use `async/await` consistently, even for sync logic, to avoid refactors later

---

### Step 2: Run test to verify it fails

Run:

```bash
npm test -- tests/exact/path/to/test.spec.ts
```

*or (direct Playwright):*

```bash
npm run test:e2e -- -g "specific behavior"
```

**Expected result:**

* ❌ FAIL
* Error such as:

  * `Module has no exported member 'functionUnderTest'`
  * or assertion failure if stubbed incorrectly

---

### Step 3: Write minimal implementation

```ts
export async function functionUnderTest(input: InputType): Promise<ReturnType> {
  return expected;
}
```

Notes:

* Implement the **simplest possible code** to satisfy the test
* No extra branches, logging, or error handling yet

---

### Step 4: Run test to verify it passes

Run:

```bash
npm test -- tests/exact/path/to/test.spec.ts
```

*or:*

```bash
npm run test:e2e -- -g "specific behavior"
```

**Expected result:**

* ✅ PASS

---

## Planning Rules

- If uncertainty is discovered during execution, STOP and return to /plan.
- Do not leave transitional comments (“simplified”, “moved”, “for now”).
- Final code must read as inevitable, not evolutionary.
- Do not plan commits, they will be handled as part of the /finishing workflow

## Execution Handoff

**"Plan complete. Ready for /executing workflow."**
