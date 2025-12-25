import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  getEffectiveTimeMode,
  getHourInTimezone,
  getTimeModeForHour,
  calculateOverrideExpiry,
  isOverrideExpired,
} from '../../src/shared/time-mode.js';

describe('Time Mode', () => {
  describe('getTimeModeForHour', () => {
    test('returns AM for hours 4-11', () => {
      assert.equal(getTimeModeForHour(4), 'AM');
      assert.equal(getTimeModeForHour(7), 'AM');
      assert.equal(getTimeModeForHour(11), 'AM');
    });

    test('returns PM for hours 12-23', () => {
      assert.equal(getTimeModeForHour(12), 'PM');
      assert.equal(getTimeModeForHour(15), 'PM');
      assert.equal(getTimeModeForHour(23), 'PM');
    });

    test('returns PM for hours 0-3 (late night)', () => {
      assert.equal(getTimeModeForHour(0), 'PM');
      assert.equal(getTimeModeForHour(1), 'PM');
      assert.equal(getTimeModeForHour(3), 'PM');
    });
  });

  describe('getHourInTimezone', () => {
    test('returns correct hour for UTC', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      assert.equal(getHourInTimezone(date, 'UTC'), 14);
    });

    test('returns correct hour for Australia/Sydney (UTC+10/11)', () => {
      // June is winter in Australia, so UTC+10
      const date = new Date('2024-06-15T14:00:00Z');
      // 14:00 UTC = 00:00 next day in Sydney (UTC+10)
      assert.equal(getHourInTimezone(date, 'Australia/Sydney'), 0);
    });

    test('falls back to UTC for invalid timezone', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      const hour = getHourInTimezone(date, 'Invalid/Timezone');
      assert.equal(hour, 14);
    });
  });

  describe('getEffectiveTimeMode', () => {
    const timezone = 'UTC';

    test('returns AM when AUTO and morning hour', () => {
      const morningDate = new Date('2024-06-15T08:00:00Z');
      const result = getEffectiveTimeMode('AUTO', null, timezone, morningDate);
      assert.equal(result, 'AM');
    });

    test('returns PM when AUTO and afternoon hour', () => {
      const afternoonDate = new Date('2024-06-15T15:00:00Z');
      const result = getEffectiveTimeMode('AUTO', null, timezone, afternoonDate);
      assert.equal(result, 'PM');
    });

    test('returns PM when AUTO and late night hour', () => {
      const lateNightDate = new Date('2024-06-15T02:00:00Z');
      const result = getEffectiveTimeMode('AUTO', null, timezone, lateNightDate);
      assert.equal(result, 'PM');
    });

    test('honors active AM override', () => {
      const now = new Date('2024-06-15T15:00:00Z'); // Afternoon
      const overrideUntil = new Date('2024-06-15T16:00:00Z').toISOString(); // 1 hour later
      const result = getEffectiveTimeMode('AM', overrideUntil, timezone, now);
      assert.equal(result, 'AM');
    });

    test('honors active PM override', () => {
      const now = new Date('2024-06-15T08:00:00Z'); // Morning
      const overrideUntil = new Date('2024-06-15T09:00:00Z').toISOString(); // 1 hour later
      const result = getEffectiveTimeMode('PM', overrideUntil, timezone, now);
      assert.equal(result, 'PM');
    });

    test('falls back to AUTO when override is expired', () => {
      const now = new Date('2024-06-15T15:00:00Z'); // Afternoon
      const overrideUntil = new Date('2024-06-15T14:00:00Z').toISOString(); // 1 hour ago
      const result = getEffectiveTimeMode('AM', overrideUntil, timezone, now);
      assert.equal(result, 'PM'); // Should use AUTO (afternoon = PM)
    });

    test('uses AUTO when override is null', () => {
      const now = new Date('2024-06-15T08:00:00Z'); // Morning
      const result = getEffectiveTimeMode('PM', null, timezone, now);
      assert.equal(result, 'AM'); // Should use AUTO (morning = AM)
    });
  });

  describe('calculateOverrideExpiry', () => {
    test('returns timestamp 1 hour from now', () => {
      const now = new Date('2024-06-15T10:00:00Z');
      const expiry = calculateOverrideExpiry(now);
      const expected = new Date('2024-06-15T11:00:00Z').toISOString();
      assert.equal(expiry, expected);
    });
  });

  describe('isOverrideExpired', () => {
    test('returns true when override is null', () => {
      assert.equal(isOverrideExpired(null), true);
    });

    test('returns true when override is in the past', () => {
      const now = new Date('2024-06-15T15:00:00Z');
      const overrideUntil = new Date('2024-06-15T14:00:00Z').toISOString();
      assert.equal(isOverrideExpired(overrideUntil, now), true);
    });

    test('returns false when override is in the future', () => {
      const now = new Date('2024-06-15T14:00:00Z');
      const overrideUntil = new Date('2024-06-15T15:00:00Z').toISOString();
      assert.equal(isOverrideExpired(overrideUntil, now), false);
    });

    test('returns true when override equals now (edge case)', () => {
      const now = new Date('2024-06-15T14:00:00Z');
      const overrideUntil = now.toISOString();
      assert.equal(isOverrideExpired(overrideUntil, now), true);
    });
  });
});
