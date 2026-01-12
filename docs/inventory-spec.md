# Inventory & Order Management

> "The system answers: Do I need to do anything this week?"

## Design Philosophy

Following Dieter Rams: the user does what they want, the software captures structure as a byproduct. No inventory dashboards to configure. No databases to build. Three simple moments:

1. **"You should order soon"** → surfaced at the right time
2. **"Copy to email"** → suggested order ready to send
3. **"How many bags do you have?"** → quick reconciliation on arrival

**Core insight**: We are not modelling inventory. We are modelling *confidence under uncertainty*.

---

## Strategic Context

**Near-term**: Owner-paid value through reduced mental load and order recommendations.

**Mid-term**: Build data that matters—consumption patterns, conversion factors, order cycles.

**Long-term**: Feed distributors become partners when we deliver order volume, demand predictability, and reduced admin cost. Longitudinal diet data valuable for manufacturers and seasonal diet analytics.

---

## Core UX

### Normal State
Nothing visible. No dashboard to check.

### When Action Needed
> **📦 Heads up: Allrounder**  
> At current feeding, you'll run low around Feb 15.  
> Your usual order should arrive by Feb 10.  
> [Order Now] [Remind Me Later]

### At Order Time
> **Suggested Order — Coprice Feeds**  
> 20 × Allrounder 20kg bags  
> [Copy to Email] [Done - Mark Ordered]

### When Order Arrives
> ✓ Coprice order arrived?  
> Quick check: How many Allrounder bags total?  
> [__20__] → [Save]

---

## Scope Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Inventory scope | **Owner-level** | Multi-barn ready; boards reference shared inventory |
| Storage location | Optional tag on StockTake | "2 in main shed, 3 in back barn" = 5 total |
| Order lifecycle | 5 states | `suggested → ordered → arriving → arrived` + `cancelled` |
| Storage constraints | **Deferred** | Too complex (shared across substitutable feeds); `typical_order_qty` captures practical limits |
| Typical order learning | Confirm-then-adapt | Ask once, re-validate against burn rate, re-prompt if patterns change |

---

## Data Model

### Principle: Store Facts, Compute Views

**Facts** (can't be reconstructed):
- DietChange, StockTake, Order

**Views** (always derivable):
- Weekly consumption, burn rates, run-out predictions

### Inventory (new)
| Field | Notes |
|-------|-------|
| owner_id | Scoped to owner, not board |
| feed_id | Links to feed |
| inventory_unit | "20kg bag" |
| quantity | Current stock |
| conversion_factor | Dosage units per inventory unit |
| conversion_confidence | none → low → medium → high |
| supplier_name | Free text → supplier_id later |
| product_sku | For future product catalog |
| typical_order_qty | Confirmed by owner, re-validated against burn |
| typical_order_cycle_days | Learned from order history |

### Order (new)
| Field | Notes |
|-------|-------|
| inventory_id | What was ordered |
| quantity_ordered | In inventory units |
| status | suggested / ordered / arriving / arrived / cancelled |
| ordered_at, expected_at, arrived_at | timestamps |

### StockTake (new)
| Field | Notes |
|-------|-------|
| inventory_id | |
| counted_quantity | Actual count |
| taken_at | |
| source | arrival / manual / adjustment |
| location_note | Optional: "main shed", "back barn" |
| note | "found 2 in shed" |

### DietChange (new)
Captures diet history for longitudinal analysis. Debounced by 4-hour window.

| Field | Notes |
|-------|-------|
| horse_id, feed_id | |
| changed_at | |
| prev_am, prev_pm | nullable for first entry |
| new_am, new_pm | |
| prev_variant, new_variant | for choice types |

### ConversionObservation (new)
Tracks refinement process. Keep ~10-15 observations.

| Field | Notes |
|-------|-------|
| inventory_id | |
| observed_at | Stock take timestamp |
| dosage_consumed | Computed from DietChange history |
| inventory_delta | Units consumed since last observation |
| implied_factor | dosage / delta |
| deviation | From current factor |
| outcome | accepted / flagged / ignored |

---

## Conversion Factor Learning

### Goal
Hone in on the "true" conversion factor and keep it there with high confidence.

### Algorithm
```
On stock take:
1. Calculate implied_factor from observation
2. Compare to running mean of accepted observations:
   - Within 1 SD → accept, weighted update, confidence++
   - 1-2 SD in same direction (3+ consecutive) → systematic drift, alert owner
   - > 2 SD → outlier, alert owner, don't update
```

### Confidence Levels
- **none**: No observations yet
- **low**: 1-2 observations, high variance
- **medium**: 3-5 observations, converging
- **high**: 6+ observations, stable ±5%

Confidence decreases on flagged observations or detected drift.

### Anomaly Alerts
User sees simple prompts:
> "Your Allrounder is running out faster than expected. New scoop, or feeding more?"

They don't see the statistics—just actionable information.

---

## Order Recommendations

### Prediction Logic
```
daily_burn_rate = compute_from_diet_history(7_days)
current_stock = inventory.quantity × conversion_factor
days_remaining = current_stock / daily_burn_rate
runout_date = today + days_remaining

lead_time = learned from order history
buffer = 3 days
order_trigger = runout_date - lead_time - buffer

if today >= order_trigger:
  surface_recommendation()
```

### Key Insight
> "At current diets, your usual Allrounder order will no longer be sufficient by mid-April. You should plan to order early this cycle."

The system answers questions the owner didn't know to ask.

---

## Future Considerations

### Product Catalog
Products become global entities; feeds reference products via product_id. Enables cross-stable analytics.

### Supplier Integration
Email export → PDF → API integration. Standing orders, recurring schedules.

### Longitudinal Diet Analytics
Per-horse consumption computed from DietChange history. Seasonal pattern detection.

### Consumption Rollups
Materialize weekly aggregates only when query performance requires it.

---

## Edge Cases (Acknowledged, Deferred)

- Multiple storage locations for same feed
- Emergency top-ups outside normal distributors
- Feed substitutions (temporary replacements)
- Horses temporarily leaving / arriving
- Seasonal feeds that disappear entirely

Data model doesn't forbid these; solutions deferred.

---

## Implementation Readiness

| Area | Readiness | Notes |
|------|-----------|-------|
| **Inventory table + CRUD** | ✅ Ready | Schema clear. Add `owner_id` FK, basic API endpoints. |
| **StockTake recording** | ✅ Ready | Simple event table. UI: number input on order arrival. |
| **Order table + basic states** | ✅ Ready | 5 states defined. Start with suggested → ordered → arrived flow. |
| **DietChange event capture** | ⚠️ Needs design | 4-hour debounce logic: where does it run? Background job? On-save with buffer table? |
| **Consumption computation** | ⚠️ Needs design | Query to compute consumption from DietChange history. Need to handle: gaps, archived horses, variant types. |
| **Conversion factor learning** | 🔴 Explore first | Statistical approach is sound but may be over-engineered for sparse early data. Start with simple average, add SD logic when volume justifies. |
| **Order recommendations UI** | ⚠️ Needs design | Where does it surface? New tab? Alert badge? Modal? Need UX mockups. |
| **Typical order confirmation** | ✅ Ready | Simple prompt on first order: "Is 20 bags your usual?" |
| **Burn rate prediction** | ⚠️ Needs design | Depends on consumption computation. Also: how far back to look? Handle diet changes mid-window? |
| **Email export / copy** | ✅ Ready | Simple text generation. "20 × Allrounder 20kg" format. |

### Suggested Development Sequence

1. **Inventory + StockTake** — Foundation, low risk, immediate value for manual tracking
2. **Order table + basic flow** — Enables "mark as ordered / arrived" workflow
3. **DietChange capture** — Enables consumption computation, blocks conversion learning
4. **Consumption queries** — Unlocks burn rate and predictions
5. **Order recommendations** — The "magic" moment, needs all above

### Open Questions for Dev Team

1. **DietChange debounce**: Buffer table with background job, or client-side debounce before save?
2. **Inventory UI location**: New "Inventory" tab, or extend existing Feeds tab?
3. **Order recommendation trigger**: Background scheduler, or compute on Controller load?
4. **Conversion learning V1**: Skip SD math initially, use simple rolling average with manual override?
5. **Multi-board owners**: If owner has 2 boards, do they see combined inventory in both? Or pick one as "primary"?
