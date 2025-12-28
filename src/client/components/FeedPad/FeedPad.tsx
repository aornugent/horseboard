import { useState, useEffect } from 'preact/hooks';
import { formatQuantity, getQuickPresets, QUANTITY_STEP } from '@shared/fractions';
import './FeedPad.css';

// Get presets once (they're static)
const QUICK_PRESETS = getQuickPresets();

interface FeedPadProps {
  isOpen: boolean;
  currentValue: number | null;
  onConfirm: (value: number | null) => void;
  onClose: () => void;
  feedName: string;
  unit: string;
}

export function FeedPad({
  isOpen,
  currentValue,
  onConfirm,
  onClose,
  feedName,
  unit,
}: FeedPadProps) {
  // Local editing state - only saved when Done is clicked
  const [editValue, setEditValue] = useState<number | null>(currentValue);

  // Reset edit value when FeedPad opens with new currentValue
  useEffect(() => {
    if (isOpen) {
      setEditValue(currentValue);
    }
  }, [isOpen, currentValue]);

  const handleDecrement = () => {
    const newValue = Math.max(0, (editValue ?? 0) - QUANTITY_STEP);
    setEditValue(newValue === 0 ? null : newValue);
  };

  const handleIncrement = () => {
    setEditValue((editValue ?? 0) + QUANTITY_STEP);
  };

  const handlePreset = (value: number | null) => {
    setEditValue(value);
  };

  const handleConfirm = () => {
    onConfirm(editValue);
    onClose();
  };

  const handleCancel = () => {
    // Just close without saving - editValue will be reset on next open
    onClose();
  };

  return (
    <div
      class={`feed-pad-overlay ${isOpen ? 'feed-pad-overlay--open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
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
            onClick={handleCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Current value display */}
        <div class="feed-pad-current" data-testid="feed-pad-current">
          <span class="feed-pad-current-value">
            {formatQuantity(editValue, unit) || '—'}
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
            {formatQuantity(editValue, unit) || '0'}
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
          onClick={handleConfirm}
        >
          Done
        </button>
      </div>
    </div>
  );
}
