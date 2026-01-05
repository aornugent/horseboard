import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  formatQuantity,
  parseQuantity,
  getFractionPresets,
} from '../../src/shared/fractions.js';

describe('Fractions', () => {
  describe('formatQuantity', () => {
    test('returns empty string for null', () => {
      assert.equal(formatQuantity(null), '');
    });

    test('returns empty string for zero', () => {
      assert.equal(formatQuantity(0), '');
    });

    test('formats quarter as fraction', () => {
      assert.equal(formatQuantity(0.25), '¼');
    });

    test('formats third as fraction', () => {
      assert.equal(formatQuantity(0.33), '⅓');
    });

    test('formats half as fraction', () => {
      assert.equal(formatQuantity(0.5), '½');
    });

    test('formats two-thirds as fraction', () => {
      assert.equal(formatQuantity(0.67), '⅔');
    });

    test('formats three-quarters as fraction', () => {
      assert.equal(formatQuantity(0.75), '¾');
    });

    test('formats integer + fraction', () => {
      assert.equal(formatQuantity(1.5), '1½');
      assert.equal(formatQuantity(2.25), '2¼');
      assert.equal(formatQuantity(3.75), '3¾');
    });

    test('formats whole numbers as-is', () => {
      assert.equal(formatQuantity(1), '1');
      assert.equal(formatQuantity(2), '2');
      assert.equal(formatQuantity(10), '10');
    });

    test('formats whole numbers with unit as just the number', () => {
      assert.equal(formatQuantity(1, 'scoop'), '1');
      assert.equal(formatQuantity(2, 'oz'), '2');
    });

    test('formats non-standard decimals with unit', () => {
      assert.equal(formatQuantity(1.6, 'ml'), '1.6 ml');
      assert.equal(formatQuantity(0.4, 'scoop'), '0.4 scoop');
    });

    test('formats non-standard decimals without unit', () => {
      assert.equal(formatQuantity(1.6), '1.6');
      assert.equal(formatQuantity(0.4), '0.4');
    });

    test('handles floating point precision', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      assert.equal(formatQuantity(0.1 + 0.2), '0.30000000000000004');
    });
  });

  describe('parseQuantity', () => {
    test('returns null for empty string', () => {
      assert.equal(parseQuantity(''), null);
    });

    test('returns null for whitespace', () => {
      assert.equal(parseQuantity('   '), null);
    });

    test('returns null for null input', () => {
      assert.equal(parseQuantity(null), null);
    });

    test('parses quarter fraction', () => {
      assert.equal(parseQuantity('¼'), 0.25);
    });

    test('parses third fraction', () => {
      assert.equal(parseQuantity('⅓'), 0.33);
    });

    test('parses half fraction', () => {
      assert.equal(parseQuantity('½'), 0.5);
    });

    test('parses two-thirds fraction', () => {
      assert.equal(parseQuantity('⅔'), 0.67);
    });

    test('parses three-quarters fraction', () => {
      assert.equal(parseQuantity('¾'), 0.75);
    });

    test('parses integer + fraction', () => {
      assert.equal(parseQuantity('1½'), 1.5);
      assert.equal(parseQuantity('2¼'), 2.25);
      assert.equal(parseQuantity('3¾'), 3.75);
    });

    test('parses whole numbers', () => {
      assert.equal(parseQuantity('1'), 1);
      assert.equal(parseQuantity('2'), 2);
      assert.equal(parseQuantity('10'), 10);
    });

    test('parses decimal numbers', () => {
      assert.equal(parseQuantity('1.5'), 1.5);
      assert.equal(parseQuantity('0.25'), 0.25);
    });

    test('parses numbers with units (strips unit)', () => {
      assert.equal(parseQuantity('1.6 ml'), 1.6);
      assert.equal(parseQuantity('2 scoops'), 2);
    });

    test('handles whitespace', () => {
      assert.equal(parseQuantity('  ½  '), 0.5);
      assert.equal(parseQuantity('  2  '), 2);
    });
  });

  describe('roundtrip formatting', () => {
    test('format then parse returns original value', () => {
      const testValues = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.25, 3.75];
      for (const value of testValues) {
        const formatted = formatQuantity(value);
        const parsed = parseQuantity(formatted);
        assert.equal(parsed, value, `Roundtrip failed for ${value}`);
      }
    });
  });

  describe('getFractionPresets', () => {
    test('returns array of presets', () => {
      const presets = getFractionPresets();
      assert.ok(Array.isArray(presets));
      assert.ok(presets.length > 0);
    });

    test('each preset has value and label', () => {
      const presets = getFractionPresets();
      for (const preset of presets) {
        assert.ok(typeof preset.value === 'number');
        assert.ok(typeof preset.label === 'string');
      }
    });

    test('includes common values', () => {
      const presets = getFractionPresets();
      const values = presets.map((p) => p.value);
      assert.ok(values.includes(0.5));
      assert.ok(values.includes(1));
      assert.ok(values.includes(2));
    });
  });
});
