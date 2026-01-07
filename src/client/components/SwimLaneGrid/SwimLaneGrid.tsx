import { getStrategyForType, parseEntryOptions } from '@shared/unit-strategies';
import type { GridItem, GridCell } from '../../../shared/grid-logic';
import './SwimLaneGrid.css';

interface SwimLaneGridProps {
  columns: GridItem[];
  rows: GridItem[];
  cells: GridCell[][];
  isEditable: boolean;
  onCellClick?: (colId: string, rowId: string) => void;
}

export function SwimLaneGrid({
  columns,
  rows,
  cells,
  isEditable,
  onCellClick,
}: SwimLaneGridProps) {
  return (
    <div class="swim-lane-grid" data-testid="swim-lane-grid">
      {/* Header row */}
      <div class="grid-header" data-testid="grid-header">
        <div class="corner-cell" />
        {columns.map((col, idx) => (
          <div
            key={col.id}
            class={`horse-header ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'}`}
            data-testid={`column-header-${col.id}`}
          >
            {col.name}
          </div>
        ))}
      </div>

      {/* Body: Rows */}
      {rows.map((row, rowIdx) => (
        <div key={row.id} class="feed-row" data-testid={`row-${row.id}`}>
          <div class="feed-name" data-testid={`row-header-${row.id}`}>
            {row.name}
          </div>
          {columns.map((col, colIdx) => {
            const cell = cells[colIdx][rowIdx];
            const hasValue = (cell.value !== null && cell.value !== undefined && cell.value !== 0) || !!cell.variant;

            // Format display text using unitConfig if available on either axis
            const unitConfig = row.unitConfig || col.unitConfig;
            let displayText = '';

            if (unitConfig) {
              const strategy = getStrategyForType(unitConfig.unit_type as any);
              const options = parseEntryOptions(unitConfig.entry_options, unitConfig.unit_type as any);
              displayText = strategy.formatDisplay(cell.value, cell.variant, options, unitConfig.unit_label);
            } else {
              // Fallback if no config (shouldn't happen for feeds)
              displayText = cell.variant || (cell.value?.toString() ?? '');
            }

            return (
              <div
                key={col.id}
                // Use rowIdx for alternating colors to match original design which alternated by column?
                // Original: horseList.map((horse, idx) => className={idx % 2 ...})
                // Columns are Horses in horse-major.
                // So columns should alternate colors?
                // Yes, existing code alternated columns.
                class={`grid-cell ${colIdx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'} ${isEditable ? 'grid-cell--editable' : ''}`}
                data-testid={`cell-${col.id}-${row.id}`}
                onClick={() => isEditable && onCellClick?.(col.id, row.id)}
              >
                {/* Badge Container */}
                {hasValue && (
                  <div class="scoop-badge" data-testid={`badge-${col.id}-${row.id}`}>
                    <span class="badge-value">
                      {displayText}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Footer: Notes (Only if columns have notes, e.g. Horses) */}
      <div class="grid-footer" data-testid="grid-footer">
        <div class="corner-cell" />
        {columns.map((col, idx) => (
          <div
            key={col.id}
            class={`horse-note ${idx % 2 === 0 ? 'swim-lane-primary' : 'swim-lane-alt'}`}
            data-testid={`note-${col.id}`}
          >
            {col.note || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

