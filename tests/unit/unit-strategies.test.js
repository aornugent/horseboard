import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
    getStrategyForType,
    UNIT_TYPES,
    parseQuantity,
} from '../../src/shared/unit-strategies.js';

describe('UnitStrategy', () => {
    describe('getStrategyForType', () => {
        test('returns fraction strategy for fraction type', () => {
            const strategy = getStrategyForType('fraction');
            assert.equal(strategy.type, 'fraction');
            assert.equal(strategy.getDefaultLabel(), 'scoop');
            assert.equal(strategy.getStepSize(), 0.25);
        });

        test('returns int strategy for int type', () => {
            const strategy = getStrategyForType('int');
            assert.equal(strategy.type, 'int');
            assert.equal(strategy.getDefaultLabel(), 'biscuit');
            assert.equal(strategy.getStepSize(), 1);
        });

        test('returns decimal strategy for decimal type', () => {
            const strategy = getStrategyForType('decimal');
            assert.equal(strategy.type, 'decimal');
            assert.equal(strategy.getDefaultLabel(), 'ml');
            assert.equal(strategy.getStepSize(), null); // text input
        });

        test('returns choice strategy for choice type', () => {
            const strategy = getStrategyForType('choice');
            assert.equal(strategy.type, 'choice');
            assert.equal(strategy.getDefaultLabel(), '');
            assert.equal(strategy.getStepSize(), null);
        });
    });

    describe('fraction strategy formatting', () => {
        test('formats half as fraction', () => {
            const strategy = getStrategyForType('fraction');
            assert.equal(strategy.formatDisplay(0.5, null, null), '½');
        });

        test('formats integer+fraction', () => {
            const strategy = getStrategyForType('fraction');
            assert.equal(strategy.formatDisplay(1.5, null, null), '1½');
        });
    });

    describe('int strategy formatting', () => {
        test('formats whole number without label', () => {
            const strategy = getStrategyForType('int');
            assert.equal(strategy.formatDisplay(2, null, null), '2');
        });
    });

    describe('decimal strategy formatting', () => {
        test('formats decimal with label', () => {
            const strategy = getStrategyForType('decimal');
            assert.equal(strategy.formatDisplay(200, null, null, 'ml'), '200 ml');
        });
    });

    describe('choice strategy formatting', () => {
        test('formats using variant label', () => {
            const strategy = getStrategyForType('choice');
            assert.equal(strategy.formatDisplay(1, 'Small', null), 'Small');
        });

        test('falls back to amount if no variant', () => {
            const strategy = getStrategyForType('choice');
            const options = [{ value: 1, label: 'Small' }, { value: 2, label: 'Large' }];
            assert.equal(strategy.formatDisplay(1, null, options), 'Small');
        });
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
