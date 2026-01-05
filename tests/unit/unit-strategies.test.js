import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
    getStrategyForType,
    UNIT_TYPES,
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
