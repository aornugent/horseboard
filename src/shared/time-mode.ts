/**
 * Time Mode Logic
 *
 * Determines whether to display AM or PM feeding schedule based on:
 * 1. Manual override (if set and not expired)
 * 2. Automatic detection based on current time in the display's timezone
 *
 * AUTO mode rules:
 * - 04:00 - 11:59 = AM
 * - 12:00 - 03:59 = PM
 */

import { TIME_MODE, type TimeMode, type EffectiveTimeMode } from './resources';

// Re-export types and constants for convenience
export type { TimeMode, EffectiveTimeMode };
export { TIME_MODE };

/**
 * Calculate the effective time mode (AM or PM) based on settings and current time
 *
 * @param mode - The configured time mode (AUTO, AM, or PM)
 * @param overrideUntil - ISO timestamp when manual override expires (null if no override)
 * @param timezone - IANA timezone string (e.g., 'Australia/Sydney')
 * @param now - Current date/time (defaults to now, injectable for testing)
 * @returns 'AM' or 'PM'
 */
export function getEffectiveTimeMode(
  mode: TimeMode,
  overrideUntil: string | null,
  timezone: string,
  now: Date = new Date()
): EffectiveTimeMode {
  // Check for active manual override
  if (mode !== TIME_MODE.AUTO && overrideUntil) {
    const overrideExpiry = new Date(overrideUntil);
    if (overrideExpiry > now) {
      return mode as EffectiveTimeMode;
    }
  }

  // AUTO mode: determine based on current hour in timezone
  return getTimeModeForHour(getHourInTimezone(now, timezone));
}

/**
 * Get the current hour (0-23) in the specified timezone
 */
export function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(date);

    // Handle "24" which some locales return for midnight
    const hour = parseInt(formatted, 10);
    return hour === 24 ? 0 : hour;
  } catch {
    // Fallback to UTC if timezone is invalid
    return date.getUTCHours();
  }
}

/**
 * Determine AM/PM based on hour
 * AM: 04:00 - 11:59 (hours 4-11)
 * PM: 12:00 - 03:59 (hours 12-23, 0-3)
 */
export function getTimeModeForHour(hour: number): EffectiveTimeMode {
  return hour >= 4 && hour < 12 ? TIME_MODE.AM : TIME_MODE.PM;
}

/**
 * Calculate override expiry timestamp (1 hour from now)
 */
export function calculateOverrideExpiry(now: Date = new Date()): string {
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
  return expiry.toISOString();
}

/**
 * Check if an override has expired
 */
export function isOverrideExpired(overrideUntil: string | null, now: Date = new Date()): boolean {
  if (!overrideUntil) return true;
  return new Date(overrideUntil) <= now;
}
