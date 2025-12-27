import { formatQuantity, getQuickPresets, QUANTITY_STEP } from '@shared/fractions';
import './FeedPad.css';

// Get presets once (they're static)
const QUICK_PRESETS = getQuickPresets();

interface FeedPadProps {
  isOpen: boolean;
  currentValue: number | null;
  onValueChange: (value: number | null) => void;
  onClose: () => void;
  feedName: string;
  unit: string;
}

export function FeedPad({
  isOpen,
  currentValue,
  onValueChange,
  onClose,
  feedName,
  unit,
}: FeedPadProps) {
  const handleDecrement = () => {
    const newValue = Math.max(0, (currentValue ?? 0) - QUANTITY_STEP);
    onValueChange(newValue === 0 ? null : newValue);
  };

  const handleIncrement = () => {
    onValueChange((currentValue ?? 0) + QUANTITY_STEP);
  };

  const handlePreset = (value: number | null) => {
    onValueChange(value);
  };

  return (
    <div
      class={`feed-pad-overlay ${isOpen ? 'feed-pad-overlay--open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        class={`feed-pad-drawer ${isOpen ? 'feed-pad-drawer--open' : ''}`}
        data-testid="feed-pad"
        aria-hidden={!isOpen}
      >
        <div class="feed-pad-header">
          <h3 class="feed-pad-title">{feedName}</h3>
          <button
            class="feed-pad-close"
            data-testid="feed-pad-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Current value display */}
        <div class="feed-pad-current" data-testid="feed-pad-current">
          <span class="feed-pad-current-value">
            {formatQuantity(currentValue, unit) || '—'}
          </span>
          <span class="feed-pad-current-unit">{unit}</span>
        </div>

        {/* Row 1: Presets (large touch targets, min 48px) */}
        <div class="feed-pad-presets" data-testid="feed-pad-presets">
          {QUICK_PRESETS.map((preset, index) => (
            <button
              key={index}
              class="feed-pad-preset"
              data-testid={`preset-${preset.value ?? 'empty'}`}
              onClick={() => handlePreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Row 2: Stepper (increments in configurable steps) */}
        <div class="feed-pad-stepper" data-testid="feed-pad-stepper">
          <button
            class="feed-pad-stepper-btn"
            data-testid="stepper-decrement"
            onClick={handleDecrement}
            aria-label={`Decrease by ${QUANTITY_STEP}`}
          >
            −
          </button>
          <div class="feed-pad-stepper-value" data-testid="stepper-value">
            {formatQuantity(currentValue, unit) || '0'}
          </div>
          <button
            class="feed-pad-stepper-btn"
            data-testid="stepper-increment"
            onClick={handleIncrement}
            aria-label={`Increase by ${QUANTITY_STEP}`}
          >
            +
          </button>
        </div>

        <button
          class="feed-pad-confirm"
          data-testid="feed-pad-confirm"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
