import { SwimLaneGrid } from '../components/SwimLaneGrid/SwimLaneGrid';
import { horseStore, feedStore, boardStore } from '../stores';
import './Board.css';

export function Board() {
  const hasData = horseStore.items.value.length > 0;
  const pairCode = boardStore.board.value?.pair_code;

  return (
    <div
      class="board-view"
      data-theme={boardStore.effective_time_mode.value.toLowerCase()}
      data-testid="board-view"
    >
      <header class="board-header">
        {pairCode && (
          <div class="board-pair-code" data-testid="board-pair-code">
            <span class="board-pair-code-label">Code:</span>
            <span class="board-pair-code-value">{pairCode}</span>
          </div>
        )}
        <div class="board-time-badge" data-testid="time-mode-badge">
          {boardStore.effective_time_mode.value}
        </div>
      </header>

      <main class="board-content">
        {hasData ? (
          <SwimLaneGrid
            horses={horseStore.items}
            feeds={feedStore.items}
            timeMode={boardStore.effective_time_mode}
            isEditable={false}
          />
        ) : (
          <div class="board-empty" data-testid="board-empty">
            <div class="board-empty-content">
              <h2 class="board-empty-title">Welcome to HorseBoard</h2>
              <p class="board-empty-text">
                Use a phone to connect and add horses
              </p>
              {pairCode && (
                <div class="board-empty-code">
                  <span class="board-empty-code-label">Enter this code on your phone:</span>
                  <span class="board-empty-code-value" data-testid="board-empty-pair-code">
                    {pairCode}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
