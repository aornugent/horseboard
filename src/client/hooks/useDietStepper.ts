import { getStrategyForType } from '@shared/unit-strategies';
import { getDiet, updateDietAmount, getFeed } from '../stores';
import { upsertDiet } from '../services/api';

/**
 * Hook for inline diet value adjustments.
 * Encapsulates the step calculation and optimistic update + API sync pattern.
 */
export function useDietStepper(horseId: string) {
    const increment = async (feedId: string, field: 'am_amount' | 'pm_amount') => {
        const feed = getFeed(feedId);
        if (!feed) return false;

        const strategy = getStrategyForType(feed.unit_type);
        const stepSize = strategy.getStepSize();

        // If no stepper (decimal/choice), signal to open FeedPad instead
        if (stepSize === null) return false;

        const entry = getDiet(horseId, feedId);
        const currentValue = entry?.[field] ?? 0;
        const newValue = currentValue + stepSize;

        // Optimistic update
        updateDietAmount(horseId, feedId, field, newValue);

        const am = field === 'am_amount' ? newValue : entry?.am_amount ?? null;
        const pm = field === 'pm_amount' ? newValue : entry?.pm_amount ?? null;

        try {
            await upsertDiet(horseId, feedId, am, pm, entry?.am_variant ?? null, entry?.pm_variant ?? null);
            return true;
        } catch (error) {
            console.error('Failed to save diet entry:', error);
            // Rollback
            updateDietAmount(horseId, feedId, field, currentValue);
            return true; // Still handled, just failed
        }
    };

    const decrement = async (feedId: string, field: 'am_amount' | 'pm_amount') => {
        const feed = getFeed(feedId);
        if (!feed) return false;

        const strategy = getStrategyForType(feed.unit_type);
        const stepSize = strategy.getStepSize();

        // If no stepper (decimal/choice), signal to open FeedPad instead
        if (stepSize === null) return false;

        const entry = getDiet(horseId, feedId);
        const currentValue = entry?.[field] ?? 0;
        const newValue = Math.max(0, currentValue - stepSize);
        const finalValue = newValue === 0 ? null : newValue;

        // Optimistic update
        updateDietAmount(horseId, feedId, field, finalValue);

        const am = field === 'am_amount' ? finalValue : entry?.am_amount ?? null;
        const pm = field === 'pm_amount' ? finalValue : entry?.pm_amount ?? null;

        try {
            await upsertDiet(horseId, feedId, am, pm, entry?.am_variant ?? null, entry?.pm_variant ?? null);
            return true;
        } catch (error) {
            console.error('Failed to save diet entry:', error);
            // Rollback
            updateDietAmount(horseId, feedId, field, currentValue);
            return true;
        }
    };

    return { increment, decrement };
}
