/**
 * Fraction Formatting
 *
 * Converts decimal quantities to human-readable format with Unicode fractions.
 * Used for the TV board to show feed amounts in an easy-to-read format.
 *
 * Examples:
 * - 0.25 → ¼
 * - 0.5 → ½
 * - 1.5 → 1½
 * - 2.75 → 2¾
 * - 0.6 → 0.6 (no fraction available)
 */

/**
 * Supported fraction values with their Unicode representations
 * Stored as [decimal, unicode] tuples for iteration
 */
export const FRACTION_ENTRIES: ReadonlyArray<readonly [number, string]> = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.67, '⅔'],
  [0.75, '¾'],
] as const;

/**
 * Map of decimal fractions to Unicode characters (derived from FRACTION_ENTRIES)
 */
const FRACTION_MAP: Record<number, string> = Object.fromEntries(FRACTION_ENTRIES);

/**
 * Reverse map: Unicode fraction to decimal value
 */
const FRACTION_REVERSE_MAP: Record<string, number> = Object.fromEntries(
  FRACTION_ENTRIES.map(([value, char]) => [char, value])
);

/**
 * Tolerance for floating point comparison
 */
export const EPSILON = 0.01;

/**
 * Step size for quantity adjustments (stepper increment/decrement)
 */
export const QUANTITY_STEP = 0.25;

/**
 * Find matching fraction character for a decimal value
 */
function findFraction(decimal: number): string | null {
  for (const [value, char] of Object.entries(FRACTION_MAP)) {
    if (Math.abs(decimal - parseFloat(value)) < EPSILON) {
      return char;
    }
  }
  return null;
}

/**
 * Format a quantity for the board
 *
 * @param value - The numeric value (null or 0 returns empty string)
 * @param unit - Optional unit to append for non-fraction values
 * @returns Formatted string (e.g., "2½", "¾", "1.6 scoops", or "")
 */
export function formatQuantity(value: number | null, unit?: string): string {
  // Null or zero renders as blank (design requirement)
  if (value === null || value === 0) {
    return '';
  }

  const intPart = Math.floor(value);
  const decPart = Math.round((value - intPart) * 100) / 100;

  // Integers should be returned without unit (matches fraction behavior)
  if (decPart === 0) {
    return String(intPart);
  }

  // Check if decimal part maps to a fraction
  const fraction = findFraction(decPart);

  if (fraction) {
    // Has a nice fraction representation
    if (intPart > 0) {
      return `${intPart}${fraction}`;
    }
    return fraction;
  }

  // No fraction match - show decimal with optional unit
  if (unit) {
    return `${value} ${unit}`;
  }

  return String(value);
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
 */
export function getQuickPresets(): Array<{ value: number | null; label: string }> {
  return [
    { value: null, label: 'Empty' },
    { value: 0.5, label: '½' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
  ];
}
