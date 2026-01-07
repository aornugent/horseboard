import { useState, useEffect } from 'preact/hooks';
import { getStrategyForType, parseEntryOptions, type UnitType } from '@shared/unit-strategies';


interface FeedPadProps {
  isOpen: boolean;
  currentValue: number | null;
  currentVariant?: string | null;
  onConfirm: (value: number | null, variant: string | null) => void;
  onClose: () => void;
  feedName: string;
  unitType: UnitType;
  unitLabel: string;
  entryOptions: string | null;
}

export function FeedPad({
  isOpen,
  currentValue,
  currentVariant,
  onConfirm,
  onClose,
  feedName,
  unitType,
  unitLabel,
  entryOptions,
}: FeedPadProps) {
  const strategy = getStrategyForType(unitType);
  const options = parseEntryOptions(entryOptions, unitType);
  const presets = strategy.getPresets(options);
  const stepSize = strategy.getStepSize();

  const [editValue, setEditValue] = useState<number | null>(currentValue);
  const [editVariant, setEditVariant] = useState<string | null>(currentVariant ?? null);

  useEffect(() => {
    if (isOpen) {
      setEditValue(currentValue);
      setEditVariant(currentVariant ?? null);
    }
  }, [isOpen, currentValue, currentVariant]);

  const handleDecrement = () => {
    if (stepSize === null) return;
    const newValue = Math.max(0, (editValue ?? 0) - stepSize);
    setEditValue(newValue === 0 ? null : newValue);
    // Clearing variant on stepper change? Plan says setEditVariant(null).
    setEditVariant(null);
  };

  const handleIncrement = () => {
    if (stepSize === null) return;
    setEditValue((editValue ?? 0) + stepSize);
    setEditVariant(null);
  };

  const handlePreset = (value: number | null, label?: string) => {
    setEditValue(value);
    // For choice type, store the label as variant
    if (unitType === 'choice' && label && value !== null) {
      setEditVariant(label);
    } else {
      setEditVariant(null);
    }
  };

  const handleConfirm = () => {
    onConfirm(editValue, editVariant);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // The strategy formatDisplay might accept label as 4th arg
  // We pass undefined for label because FeedPad renders the unit label separately below
  const displayValue = strategy.formatDisplay(editValue, editVariant, options);

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
          <span class="feed-pad-current-value">{displayValue || '—'}</span>
          {unitType !== 'choice' && <span class="feed-pad-current-unit">{unitLabel}</span>}
        </div>

        {/* Presets */}
        <div class="feed-pad-presets" data-testid="feed-pad-presets">
          {presets.map((preset, index) => (
            <button
              key={index}
              class="feed-pad-preset"
              data-testid={`preset-${preset.value ?? 'empty'}`}
              onClick={() => handlePreset(preset.value, preset.label)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Stepper (only for fraction/int types) */}
        {stepSize !== null && (
          <div class="feed-pad-stepper" data-testid="feed-pad-stepper">
            <button
              class="feed-pad-stepper-btn"
              data-testid="stepper-decrement"
              onClick={handleDecrement}
              aria-label={`Decrease by ${stepSize}`}
            >
              −
            </button>
            <div class="feed-pad-stepper-value" data-testid="stepper-value">
              {displayValue || '0'}
            </div>
            <button
              class="feed-pad-stepper-btn"
              data-testid="stepper-increment"
              onClick={handleIncrement}
              aria-label={`Increase by ${stepSize}`}
            >
              +
            </button>
          </div>
        )}

        {/* Text input (for decimal type) */}
        {unitType === 'decimal' && (
          <div class="feed-pad-input" data-testid="feed-pad-input">
            <input
              type="number"
              inputMode="decimal"
              value={editValue ?? ''}
              onInput={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                setEditValue(isNaN(val) ? null : val);
              }}
              placeholder="Enter amount"
            />
            <span class="feed-pad-input-unit">{unitLabel}</span>
          </div>
        )}

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
