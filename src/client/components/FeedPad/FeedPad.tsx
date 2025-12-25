import { formatQuantity } from '@shared/fractions';
import './FeedPad.css';

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
    const newValue = Math.max(0, (currentValue ?? 0) - 0.25);
    onValueChange(newValue === 0 ? null : newValue);
  };

  const handleIncrement = () => {
    onValueChange((currentValue ?? 0) + 0.25);
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
          <button
            class="feed-pad-preset"
            data-testid="preset-empty"
            onClick={() => handlePreset(null)}
          >
            Empty
          </button>
          <button
            class="feed-pad-preset"
            data-testid="preset-half"
            onClick={() => handlePreset(0.5)}
          >
            ½
          </button>
          <button
            class="feed-pad-preset"
            data-testid="preset-one"
            onClick={() => handlePreset(1)}
          >
            1
          </button>
          <button
            class="feed-pad-preset"
            data-testid="preset-two"
            onClick={() => handlePreset(2)}
          >
            2
          </button>
        </div>

        {/* Row 2: Stepper (increments in 0.25 steps) */}
        <div class="feed-pad-stepper" data-testid="feed-pad-stepper">
          <button
            class="feed-pad-stepper-btn"
            data-testid="stepper-decrement"
            onClick={handleDecrement}
            aria-label="Decrease by 0.25"
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
            aria-label="Increase by 0.25"
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
