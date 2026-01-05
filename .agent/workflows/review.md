Below is a **prompt-engineered rewrite of your `/review` workflow**, incorporating the **architectural exploration expansion** while preserving what already works well in Antigravity’s slash-command / workflow model.

I have optimized this for:

* **Prompt adherence under real model behavior**
* **Clear phase separation**
* **Mechanical enforcement of architectural breadth**
* **Low token waste**
* **Compatibility with your existing artifacts**

This is intended to be a **drop-in replacement** for `/review`.

---

# `/review` — Rigorous Review with Architectural Exploration

---

## description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements and system design integrity

## Overview

Produce and respond to a rigorous code review by **explicitly alternating roles** and **forcing architectural exploration before critique**.

This workflow is designed to prevent narrow, locally optimal fixes by requiring consideration of the **entire system**, not just the diff.

---

## Agent modes & invariants

### Phases

1. **Phase 1:** Author mode — context, intent, self-review
2. **Phase 2:** Reviewer mode — detached, critical, architectural
3. **Phase 3:** Author mode — respond and act

### Hard invariant

**NO CODING DURING PHASE 2.**

The reviewer may not “fix forward” or modify implementation.

---

## Inputs

* Code changes (working tree / diff)
* Related artifacts (if present):

  * `plan.md`
  * test results
  * cleanup artifacts
  * prior review artifacts (if iterative)

---

## Phase 1 — Prepare & request review (Author mode)

**Goal:** Present the change clearly, honestly, and with known limitations.

### Step 1. Summarize the change

* What problem was solved
* Why it mattered
* High-level approach taken
* What is explicitly **out of scope**

### Step 2. Declare verification

* Tests run (exact commands)
* Results (pass/fail)
* Skipped, flaky, or known-failing tests (with reason)

### Step 3. Self-review (required)

Explicitly call out:

* Risky or complex areas
* Known limitations or shortcuts
* Deferred cleanup or TODOs
* Areas where you are **least confident**

### Required artifact

**`artifact:review-request.md`**

Must contain:

* Summary
* Verification
* Self-review notes
* “What I want feedback on”
* Optional flags:

  * `Architectural breadth requested`
  * `Possible reuse/refactor opportunity`
  * `Acceptable to recommend deletion or consolidation`

---

## Phase 2 — Perform code review (Reviewer mode)

### Role switch (explicit)

> Act as a strict, experienced reviewer with no attachment to the implementation.

**Primary goal:** Find issues and system-level risks, not validate intent.

---

### Step 1 — Architectural Exploration (Required, before critique)

Before evaluating the diff, step back and consider the change in the context of the **entire application**.

#### Architectural Exploration

Answer concisely:

1. **Problem Restatement**
   In one sentence: what problem is this change attempting to solve (ignoring how it was implemented)?

2. **Existing System Capabilities**

   * List up to **three** existing components, modules, or patterns that could plausibly address this problem.
   * **At least one must be outside the modified files.**
   * If none exist, explicitly state why.

3. **Alternative Solution Shapes**
   Enumerate at least **two** distinct approaches, such as:

   * extending an existing abstraction
   * generalizing current logic
   * consolidating or deleting similar code
   * shifting responsibility between layers
   * configuration instead of new code
     *(Do not evaluate yet.)*

4. **Why This Approach Was Likely Chosen**
   What tradeoff does the current diff optimize for? (speed, isolation, minimal blast radius, test locality, etc.)

5. **Primary Constraint Check**
   What existing constraint most limits the viable solution space?
   (API compatibility, data model, performance, ownership, migration risk, etc.)

**Constraints**

* ≤150 words
* Must reference code beyond the immediate diff

---

### Step 2 — Counterfactual Check (Required)

**If this exact implementation were forbidden, what is the next-best system-level approach?**

* One or two sentences.
* Must differ meaningfully from the current diff.

---

### Step 3 — Detailed review

Evaluate the diff using the checklist below.

#### Reviewer checklist

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

   * Dead or legacy code missed?
   * New tech debt introduced?

---

### Step 4 — Architectural Tension (Required)

If the change is correct but locally optimal, describe:

* What tension it introduces (choose at least one):

  * increasing special cases
  * increasing coupling
  * increasing surface area
  * increasing cognitive load
* What **small additional step** would reduce this tension
* Whether that step is:

  * **REQUIRED now**
  * **STRONGLY RECOMMENDED**
  * **ACCEPTABLE TECH DEBT** (explicitly named)

≤100 words.

---

### Step 5 — Findings & feedback

#### Feedback format (required)

Each comment must include:

* **Severity:** `critical | important | minor | nit`
* **Location:** file:line (or module)
* **Issue**
* **Suggested fix or question**

#### Required artifact

**`artifact:code-review.md`**

Must include:

* Architectural Exploration
* Counterfactual Check
* Review comments
* Architectural Tension
* Architectural Verdict

---

### Step 6 — Architectural Verdict (Required)

Choose one:

* ✅ Acceptable as-is
* ⚠️ Acceptable but creates manageable architectural tension
* ❌ Solves the problem but should be re-shaped

Explain briefly (≤40 words), referencing exploration or counterfactuals.

---

### Reviewer anti-patterns (explicitly forbidden)

* Treating the diff as the only viable solution
* Proposing new endpoints/modules solely to satisfy a test
* Suggesting new abstractions without identifying existing ones
* Deferring architectural concerns without naming the debt created

Recommending **code removal or consolidation** is encouraged when it improves system clarity.

---

## Phase 3 — Receive & respond (Author mode)

**Goal:** Act on feedback deliberately and transparently.

### Agent actions

1. **Classify feedback**

   * Accept (fix now)
   * Clarify (needs discussion)
   * Defer (with explicit reason)

2. **Apply accepted changes**

   * Minimal, targeted edits
   * Update or add tests as required

3. **Re-verify**

   * Re-run relevant tests
   * Confirm no regressions

4. **Respond to review**

   * For each comment:

     * Action taken or justification
     * Pointer to code change or explanation

### Required artifact

**`artifact:review-response.md`**

---

## Hard rules (unchanged but reinforced)

* ❌ Reviewer phase may not modify code
* ❌ No dismissing feedback without justification
* ✅ All critical issues must be resolved or explicitly deferred
* ✅ Role switches must be explicit in artifact headers

---

## Completion criteria

The `/review` workflow completes when:

* All review comments are addressed
* Tests pass
* Review artifacts exist:

  * `review-request`
  * `code-review`
  * `review-response`
* The agent states: **“Review complete”**
