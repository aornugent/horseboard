import { z } from 'zod';

/**
 * Unit types supported by the system
 */
export const UnitTypeSchema = z.enum(['fraction', 'int', 'decimal', 'choice']);
export type UnitType = z.infer<typeof UnitTypeSchema>;

export const UNIT_TYPES = UnitTypeSchema.options;

/**
 * Entry options schemas per unit type
 */
export const ChoiceOptionSchema = z.object({
    value: z.number(),
    label: z.string().min(1),
});

export const ChoiceOptionsSchema = z.array(ChoiceOptionSchema).min(1);
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

export const PresetOptionsSchema = z.array(z.number()).optional();
export type PresetOptions = z.infer<typeof PresetOptionsSchema>;

/**
 * Union type for entry_options based on unit_type
 */
export type EntryOptions = ChoiceOption[] | number[] | null;

/**
 * UnitStrategy interface - encapsulates per-type behavior
 */
export interface UnitStrategy {
    type: UnitType;
    getDefaultLabel(): string;
    getStepSize(): number | null;
    getPresets(options: EntryOptions | null): Array<{ value: number | null; label: string }>;
    formatDisplay(value: number | null, variant: string | null, options: EntryOptions | null, label?: string): string;
}

/**
 * Fraction constants (from fractions.ts, will be moved here)
 */
const FRACTION_ENTRIES: ReadonlyArray<readonly [number, string]> = [
    [0.25, '¼'],
    [0.33, '⅓'],
    [0.5, '½'],
    [0.67, '⅔'],
    [0.75, '¾'],
] as const;

const FRACTION_MAP: Record<number, string> = Object.fromEntries(FRACTION_ENTRIES);
const FRACTION_REVERSE_MAP: Record<string, number> = Object.fromEntries(
    FRACTION_ENTRIES.map(([value, char]) => [char, value])
);
const EPSILON = 0.01;

function findFraction(decimal: number): string | null {
    for (const [value, char] of Object.entries(FRACTION_MAP)) {
        if (Math.abs(decimal - parseFloat(value)) < EPSILON) {
            return char;
        }
    }
    return null;
}

/**
 * Fraction strategy (scoops)
 */
const fractionStrategy: UnitStrategy = {
    type: 'fraction',
    getDefaultLabel: () => 'scoop',
    getStepSize: () => 0.25,
    getPresets: () => [
        { value: null, label: 'Empty' },
        { value: 0.5, label: '½' },
        { value: 1, label: '1' },
        { value: 2, label: '2' },
    ],
    formatDisplay: (value, _variant, _options, _label) => {
        if (value === null || value === 0) return '';
        const intPart = Math.floor(value);
        const decPart = Math.round((value - intPart) * 100) / 100;
        if (decPart === 0) return String(intPart);
        const frac = findFraction(decPart);
        if (frac) return intPart > 0 ? `${intPart}${frac}` : frac;
        return String(value);
    },
};

/**
 * Integer strategy (biscuits, sachets)
 */
const intStrategy: UnitStrategy = {
    type: 'int',
    getDefaultLabel: () => 'biscuit',
    getStepSize: () => 1,
    getPresets: () => [
        { value: null, label: 'Empty' },
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
    ],
    formatDisplay: (value, _variant, _options, _label) => {
        if (value === null || value === 0) return '';
        return String(Math.round(value));
    },
};

/**
 * Decimal strategy (ml, g)
 */
const decimalStrategy: UnitStrategy = {
    type: 'decimal',
    getDefaultLabel: () => 'ml',
    getStepSize: () => null, // text input, no stepper
    getPresets: (options) => {
        if (Array.isArray(options) && options.length > 0 && typeof options[0] === 'number') {
            return [
                { value: null, label: 'Empty' },
                ...options.map((v) => ({ value: v as number, label: String(v) })),
            ];
        }
        return [
            { value: null, label: 'Empty' },
            { value: 5, label: '5' },
            { value: 10, label: '10' },
            { value: 20, label: '20' },
        ];
    },
    formatDisplay: (value, _variant, _options, label) => {
        if (value === null || value === 0) return '';
        return label ? `${value} ${label}` : String(value);
    },
};

/**
 * Choice strategy (custom options like Small/Large)
 */
const choiceStrategy: UnitStrategy = {
    type: 'choice',
    getDefaultLabel: () => '',
    getStepSize: () => null, // button selection only
    getPresets: (options) => {
        if (!Array.isArray(options)) return [{ value: null, label: 'Empty' }];
        const choices = options as ChoiceOption[];
        return [
            { value: null, label: 'Empty' },
            ...choices.map((opt) => ({ value: opt.value, label: opt.label })),
        ];
    },
    formatDisplay: (value, variant, options, _label) => {
        if (value === null || value === 0) return '';
        // Prefer variant if set
        if (variant) return variant;
        // Fall back to looking up value in options
        if (Array.isArray(options)) {
            const match = (options as ChoiceOption[]).find((o) => o.value === value);
            if (match) return match.label;
        }
        return String(value);
    },
};

/**
 * Strategy registry
 */
const strategies: Record<UnitType, UnitStrategy> = {
    fraction: fractionStrategy,
    int: intStrategy,
    decimal: decimalStrategy,
    choice: choiceStrategy,
};

/**
 * Get strategy for a unit type
 */
export function getStrategyForType(type: UnitType): UnitStrategy {
    return strategies[type] ?? fractionStrategy;
}

export function parseEntryOptions(json: string | null, type: UnitType): EntryOptions {
    if (!json) return null;
    try {
        const parsed = JSON.parse(json);
        if (type === 'choice') {
            return ChoiceOptionsSchema.parse(parsed);
        }
        return PresetOptionsSchema.parse(parsed) ?? null;
    } catch {
        return null;
    }
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
 * UI Options for unit type selection
 * Used by FeedsTab and any other UI that needs to present unit choices
 */
export const UNIT_TYPE_OPTIONS = [
    { id: 'scoop', label: 'Scoop', type: 'fraction' as UnitType, unitLabel: 'scoop' },
    { id: 'ml', label: 'ml', type: 'decimal' as UnitType, unitLabel: 'ml' },
    { id: 'biscuit', label: 'Biscuit', type: 'int' as UnitType, unitLabel: 'biscuit' },
] as const;

export type UnitTypeOptionId = typeof UNIT_TYPE_OPTIONS[number]['id'];
