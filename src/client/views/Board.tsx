import { SwimLaneGrid } from '../components/SwimLaneGrid';
import { horses, feeds, effectiveTimeMode } from '../stores';
import './Board.css';

export function Board() {
  return (
    <div
      class="board-view"
      data-theme={effectiveTimeMode.value.toLowerCase()}
      data-testid="board-view"
    >
      <header class="board-header">
        <div class="board-time-badge" data-testid="time-mode-badge">
          {effectiveTimeMode.value}
        </div>
      </header>

      <main class="board-content">
        <SwimLaneGrid
          horses={horses}
          feeds={feeds}
          timeMode={effectiveTimeMode}
          isEditable={false}
        />
      </main>
    </div>
  );
}
