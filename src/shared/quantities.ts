/**
 * Quantity Formatting & Parsing
 * 
 * Refactored to delegate formatting to UnitStrategy while keeping
 * parsing logic for backward compatibility.
 */

import { getStrategyForType } from './unit-strategies';
export { getStrategyForType, parseEntryOptions } from './unit-strategies';

/**
 * Step size for quantity adjustments (stepper increment/decrement)
 */
export const QUANTITY_STEP = 0.25;

/**
 * Supported fraction values with their Unicode representations
 * Stored as [decimal, unicode] tuples for iteration
 */
const FRACTION_ENTRIES: ReadonlyArray<readonly [number, string]> = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.67, '⅔'],
  [0.75, '¾'],
] as const;

/**
 * Reverse map: Unicode fraction to decimal value
 */
const FRACTION_REVERSE_MAP: Record<string, number> = Object.fromEntries(
  FRACTION_ENTRIES.map(([value, char]) => [char, value])
);

/**
 * Format a quantity for the board
 * Delegates to fraction strategy for backward compatibility
 * Replicates legacy behavior: appends unit only for non-integer decimals
 */
export function formatQuantity(value: number | null, unit?: string): string {
  const strategy = getStrategyForType('fraction');
  // We don't pass unit to strategy because fractionStrategy ignores it anyway, 
  // and we want to handle conditional appending here.
  const result = strategy.formatDisplay(value, null, null);

  if (!result) return '';

  // If it contains a fraction character, return as is (no unit)
  if (/[¼⅓½⅔¾]/.test(result)) {
    return result;
  }

  // If it's an integer, return as is (no unit, per legacy behavior)
  if (value !== null && value % 1 === 0) {
    return result;
  }

  // If it's a decimal (and no fraction match), append unit if provided
  if (unit) {
    return `${result} ${unit}`;
  }

  return result;
}

/**
 * Parse a formatted quantity back to a number
 * Handles both fraction strings and decimal strings
 *
 * @param input - Formatted string (e.g., "2½", "¾", "1.5")
 * @returns Parsed number or null if invalid
 */
export function parseQuantity(input: string | null | undefined): number | null {
  if (!input || input.trim() === '') {
    return null;
  }

  const trimmed = input.trim();

  // Check for pure fraction using reverse map (O(1) lookup)
  if (trimmed in FRACTION_REVERSE_MAP) {
    return FRACTION_REVERSE_MAP[trimmed];
  }

  // Check for number + fraction (e.g., "2½")
  // Look for any fraction character at the end
  for (const [value, char] of FRACTION_ENTRIES) {
    if (trimmed.endsWith(char)) {
      const intPart = trimmed.slice(0, -char.length);
      const parsed = parseInt(intPart, 10);
      if (!isNaN(parsed)) {
        return parsed + value;
      }
    }
  }

  // Try parsing as regular number (strip unit if present)
  const numMatch = trimmed.match(/^(\d+\.?\d*)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1]);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Get all available fraction presets for the FeedPad component
 * (Legacy support)
 */
export function getFractionPresets(): Array<{ value: number; label: string }> {
  return [
    { value: 0.25, label: '¼' },
    { value: 0.5, label: '½' },
    { value: 0.75, label: '¾' },
    { value: 1, label: '1' },
    { value: 1.5, label: '1½' },
    { value: 2, label: '2' },
  ];
}

/**
 * Get quick presets for FeedPad buttons (Empty, ½, 1, 2)
 * (Legacy support)
 */
export function getQuickPresets(): Array<{ value: number | null; label: string }> {
  return [
    { value: null, label: 'Empty' },
    { value: 0.5, label: '½' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
  ];
}
