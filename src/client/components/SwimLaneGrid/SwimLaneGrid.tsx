import type { Signal } from '@preact/signals';
import { formatQuantity } from '@shared/fractions';
import type { Horse, Feed, DietEntry } from '@shared/types';
import { dietByKey } from '../../stores/diet';
import './SwimLaneGrid.css';

interface SwimLaneGridProps {
  horses: Signal<Horse[]>;
  feeds: Signal<Feed[]>;
  timeMode: Signal<'AM' | 'PM'>;
  isEditable: boolean;
  onCellClick?: (horseId: string, feedId: string) => void;
}

export function SwimLaneGrid({
  horses,
  feeds,
  timeMode,
  isEditable,
  onCellClick,
}: SwimLaneGridProps) {
  const horseList = horses.value;
  const feedList = feeds.value;
  const mode = timeMode.value;
  const dietMap = dietByKey.value;

  return (
    <div class="swim-lane-grid" data-testid="swim-lane-grid">
      {/* Header row: Horse names */}
      <div class="grid-header" data-testid="grid-header">
        <div class="corner-cell" />
        {horseList.map((horse, idx) => (
          <div
            key={horse.id}
            class={`horse-header ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'}`}
            data-testid={`horse-header-${horse.id}`}
          >
            {horse.name}
          </div>
        ))}
      </div>

      {/* Body: Feed rows */}
      {feedList.map((feed) => (
        <div key={feed.id} class="feed-row" data-testid={`feed-row-${feed.id}`}>
          <div class="feed-name" data-testid={`feed-name-${feed.id}`}>
            {feed.name}
          </div>
          {horseList.map((horse, idx) => {
            const entry = dietMap.get(`${horse.id}:${feed.id}`);
            const value = mode === 'AM' ? entry?.amAmount : entry?.pmAmount;
            const hasValue = value !== null && value !== undefined && value !== 0;

            return (
              <div
                key={horse.id}
                class={`grid-cell ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'} ${isEditable ? 'grid-cell--editable' : ''}`}
                data-testid={`cell-${horse.id}-${feed.id}`}
                onClick={() => isEditable && onCellClick?.(horse.id, feed.id)}
              >
                {/* Scoop Badge: rounded square container */}
                {hasValue && (
                  <div class="scoop-badge" data-testid={`badge-${horse.id}-${feed.id}`}>
                    <span class="badge-value">
                      {formatQuantity(value, feed.unit)}
                    </span>
                  </div>
                )}
                {/* Zero/null renders as strictly blank (no dash, no "0") */}
              </div>
            );
          })}
        </div>
      ))}

      {/* Footer: Horse notes */}
      <div class="grid-footer" data-testid="grid-footer">
        <div class="corner-cell" />
        {horseList.map((horse, idx) => (
          <div
            key={horse.id}
            class={`horse-note ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'}`}
            data-testid={`note-${horse.id}`}
          >
            {horse.note}
          </div>
        ))}
      </div>
    </div>
  );
}
