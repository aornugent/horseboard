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
 *
 * @typedef {'AUTO' | 'AM' | 'PM'} TimeMode
 * @typedef {'AM' | 'PM'} EffectiveTimeMode
 */

/**
 * Calculate the effective time mode (AM or PM) based on settings and current time
 *
 * @param {TimeMode} mode - The configured time mode (AUTO, AM, or PM)
 * @param {string|null} overrideUntil - ISO timestamp when manual override expires
 * @param {string} timezone - IANA timezone string (e.g., 'Australia/Sydney')
 * @param {Date} [now] - Current date/time (defaults to now, injectable for testing)
 * @returns {EffectiveTimeMode} 'AM' or 'PM'
 */
export function getEffectiveTimeMode(mode, overrideUntil, timezone, now = new Date()) {
  // Check for active manual override
  if (mode !== 'AUTO' && overrideUntil) {
    const overrideExpiry = new Date(overrideUntil);
    if (overrideExpiry > now) {
      return mode;
    }
  }

  // AUTO mode: determine based on current hour in timezone
  return getTimeModeForHour(getHourInTimezone(now, timezone));
}

/**
 * Get the current hour (0-23) in the specified timezone
 *
 * @param {Date} date
 * @param {string} timezone
 * @returns {number}
 */
export function getHourInTimezone(date, timezone) {
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
 *
 * @param {number} hour
 * @returns {EffectiveTimeMode}
 */
export function getTimeModeForHour(hour) {
  return hour >= 4 && hour < 12 ? 'AM' : 'PM';
}

/**
 * Calculate override expiry timestamp (1 hour from now)
 *
 * @param {Date} [now]
 * @returns {string}
 */
export function calculateOverrideExpiry(now = new Date()) {
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
  return expiry.toISOString();
}

/**
 * Check if an override has expired
 *
 * @param {string|null} overrideUntil
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isOverrideExpired(overrideUntil, now = new Date()) {
  if (!overrideUntil) return true;
  return new Date(overrideUntil) <= now;
}
