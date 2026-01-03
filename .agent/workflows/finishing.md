---
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development and cleanup
---

# Finishing a Development Branch

## Overview

Guide completion of development work by testing and tidying up.

**Core principle:** Verify tests → Search for legacy / dead code → Clean up.

**Announce at start:** "I'm using the `/finishing` workflow to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting cleanup options, verify tests pass:**

```bash
# Run project's test suite
npm test 
npm run test:e2e 
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

If tests pass: Continue to Step 2.


## Step 2: Search for legacy / dead code

**Identify code that is now unused, obsolete, or made redundant by this change**

### Trace usage of changed surfaces

For every new or modified exported symbol (functions, classes, components):

* Search the repo for references
* Confirm expected call sites exist
* Flag any old implementations or adapters that are no longer referenced

### Look for superseded logic

Identify:

* Conditional branches that can no longer be reached
* Feature flags that are permanently enabled/disabled
* Old code paths replaced by the new implementation

Confirm by:

* Static search
* Tests that no longer exercise the old path

### Detect orphaned tests

Find tests that 

* No longer fail when their corresponding code is removed
* Test behavior that no longer exists
* Mark these for deletion or rewrite

### Classify findings 

For each candidate:

* **Safe to delete now** (no references, no tests depend on it)
* **Deferred cleanup** (external dependency, risky, unclear ownership)
* **Keep** (still required)


**Hard rules**

* ❌ Do not delete code without evidence
* ❌ Do not refactor “just because”
* ✅ Every deletion must be justified in the artifact

---

## Step 3: Clean up

**Remove confirmed dead code and leave the codebase simpler, clearer, and better than before**

### Delete safe candidates

* Remove code classified as *Safe to delete now*
* Remove corresponding dead tests
* Update imports, exports, and documentation

### Tighten the code

* Rename variables/functions if clarity improved post-cleanup
* Collapse unnecessary indirection introduced by legacy paths
* Remove TODOs that are now obsolete

### Re-run verification

Run the full required test suite to confirm

* No coverage regressions (if applicable)
* No behavior change beyond the intended scope

## Required artifacts

* `artifact:cleanup-summary.md`
* What was removed
* What was simplified
* What was deferred (with reasons)

### Completion criteria

The finishing workflow is complete only when:

* All tests pass
* No known dead code remains unaddressed (deleted or explicitly deferred)
* Cleanup artifacts are present and readable

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Leaving dead code**
- **Problem:** There are breadcrumbs of superceded logic
- **Fix:** Remove these when no longer needed

## Red Flags

**Never:**
- Proceed with failing tests
- Delete work without confirmation