---
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Reviewing new features

## Overview
Produce and respond to a rigorous code review by explicitly alternating between *author* and *reviewer* modes.

---

## Agent modes

* **Phase 1:** Author mode (context + self-review)
* **Phase 2:** Reviewer mode (detached, critical)
* **Phase 3:** Author mode (respond & act)

**NO CODING DURING PHASE 2.**

---

## Inputs

* Code changes (working tree)
* Related artifacts:

  * `plan.md`
  * test results
  * cleanup artifacts (if applicable)

---

## Phase 1 — Prepare & request review (Author mode)

**Goal:** Present the change clearly and honestly.

Step 1. **Summarize the change**

   * What problem was solved
   * What approach was taken
   * What is explicitly *out of scope*

Step 2. **Declare verification**

   * Tests run (commands)
   * Results (pass/fail)
   * Any skipped or flaky tests (with reason)

Step 3. **Self-review**

   * Call out:

     * Risky areas
     * Known limitations
     * TODOs or deferred cleanup

**Required artifact**

* `artifact:review-request.md`

  * Summary
  * Verification
  * Self-review notes
  * “What I want feedback on”

---

## Phase 2 — Perform code review (Reviewer mode)

**Role switch**

> Act as a strict, experienced reviewer with no attachment to the implementation.

**Goal:** Find issues, not validate intent.

**Reviewer checklist**

1. **Correctness**

   * Does the code do what it claims?
   * Edge cases and error handling
   * Race conditions / async hazards

2. **Tests**

   * Do tests fail for the right reasons?
   * Are important cases missing?
   * Are tests brittle or over-specified?

3. **Design & maintainability**

   * Is responsibility well-separated?
   * Is complexity justified?
   * Are names and abstractions clear?

4. **Cleanup & debt**

   * Any dead/legacy code missed?
   * New tech debt introduced?

**Feedback format (required)**

Each comment must include:

* **Severity:** `critical | important | minor | nit`
* **Location:** file:line (or module)
* **Issue**
* **Suggested fix or question**

**Required artifact**

* `artifact:code-review.md`

---

## Phase 3 — Receive & respond (Author mode)

**Goal:** Act on review feedback deliberately.

**Agent actions**

1. **Classify feedback**

   * Accept (fix now)
   * Clarify (needs discussion)
   * Defer (with reason)

2. **Apply accepted changes**

   * Make minimal, targeted edits
   * Update or add tests as needed

3. **Re-verify**

   * Re-run relevant tests
   * Confirm no regressions

4. **Respond to review**

   * For each review comment:

     * Action taken or justification
     * Pointer to code change (or explanation)

**Required artifact**

* `artifact:review-response.md`

---

## Hard rules

* ❌ Reviewer phase may not “fix forward”
* ❌ No dismissing feedback without justification
* ✅ All critical issues must be resolved or explicitly deferred
* ✅ Role switches must be explicit in the artifact headers

---

## Completion criteria

The `/review` workflow completes when:

* All review comments are addressed
* Tests pass
* Review artifacts (`review-request`, `code-review`, `review-response`) exist
* The agent states: **“Review complete”**
