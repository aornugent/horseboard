import { SwimLaneGrid } from '../../components/SwimLaneGrid/SwimLaneGrid';
import { horseStore, feedStore, boardStore, dietStore } from '../../stores';
import './BoardTab.css';

import { updateBoard as apiUpdateBoard, updateTimeMode as apiUpdateTimeMode, updateOrientation as apiUpdateOrientation } from '../../services';
import { TIME_MODE, TIME_MODE_CONFIG, type TimeMode, type BoardOrientation } from '../../../shared/resources';
import { useSignal } from '@preact/signals';
import { computeGrid } from '../../../shared/grid-logic';


async function changePage(delta: number) {
  if (!boardStore.board.value) return;
  const newPage = Math.max(0, (boardStore.current_page.value || 0) + delta);
  try {
    await apiUpdateBoard(boardStore.board.value.id, { current_page: newPage });
    boardStore.setCurrentPage(newPage);
  } catch (err) {
    console.error('Failed to update page:', err);
  }
}

async function changeTimeMode(mode: TimeMode) {
  if (!boardStore.board.value) return;

  // Calculate override expiry (1 hour) for non-AUTO modes, matching SettingsTab behavior
  const override_until = mode !== TIME_MODE.AUTO
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : null;

  try {
    await apiUpdateTimeMode(boardStore.board.value.id, mode, override_until);
    boardStore.updateTimeMode(mode, override_until);  // Update local store so UI reflects change
  } catch (err) {
    console.error('Failed to update time mode:', err);
  }
}

async function changeZoom(level: 1 | 2 | 3) {
  if (!boardStore.board.value) return;
  try {
    await apiUpdateBoard(boardStore.board.value.id, { zoom_level: level });
    boardStore.setZoomLevel(level);
  } catch (err) {
    console.error('Failed to update zoom:', err);
  }
}

async function changeOrientation(orientation: BoardOrientation) {
  if (!boardStore.board.value) return;
  try {
    await apiUpdateOrientation(boardStore.board.value.id, orientation);
    boardStore.setOrientation(orientation);
  } catch (err) {
    console.error('Failed to update orientation:', err);
  }
}





export function BoardTab() {
  const showControls = useSignal(false);

  return (
    <div class="board-tab" data-testid="board-tab">
      <div class="board-tab-header">
        <h2 class="board-tab-title">Board Preview</h2>
        <span class="board-tab-badge">{boardStore.effective_time_mode.value}</span>
      </div>

      <div class="board-controls">
        <button
          class="board-control-btn"
          onClick={() => changePage(-1)}
          disabled={(boardStore.current_page.value || 0) <= 0}
          data-testid="prev-page-btn"
        >
          ◀ Previous
        </button>
        <span class="board-page-indicator" data-testid="page-indicator">Page {(boardStore.current_page.value || 0) + 1}</span>
        <button
          class="board-control-btn"
          onClick={() => changePage(1)}
          data-testid="next-page-btn"
        >
          Next ▶
        </button>
      </div>

      <div class="board-label">
        <span class="board-label-text">Read-Only TV Preview</span>
      </div>

      <div
        class="board-preview"
        data-theme={boardStore.effective_time_mode.value.toLowerCase()}
      >
        <div class="board-preview-content">
          {(() => {
            const grid = computeGrid({
              horses: horseStore.items.value,
              feeds: feedStore.items.value,
              diet: dietStore.items.value,
              orientation: boardStore.orientation.value,
              timeMode: boardStore.effective_time_mode.value,
              page: boardStore.current_page.value,
              pageSize: boardStore.pageSize.value,
              // TV uses row pagination but controller preview should match TV
              // For now, pass defaults or implement row pagination in controller too if needed
              // Assuming TV defaults (rowPage: 0, rowPageSize: Infinity or TV size?)
              // TV UX says: "The TV automatically pages through rows if they overflow"
              // Preview might just show first page for now?
            });

            return (
              <SwimLaneGrid
                columns={grid.columns}
                rows={grid.rows}
                cells={grid.cells}
                isEditable={false} // Controller is read-only
              // onCellClick?
              />
            );
          })()}
        </div>
      </div>

      <div class="board-display-controls">
        <button
          class="board-controls-toggle"
          onClick={() => showControls.value = !showControls.value}
          data-testid="toggle-display-controls"
        >
          Display Controls
          <span class="board-controls-toggle-icon">{showControls.value ? '▼' : '▶'}</span>
        </button>

        {showControls.value && (
          <div class="board-controls-drawer" data-testid="display-controls-drawer">
            <div class="board-control-group" data-testid="time-mode-selector">
              <label class="board-control-label">Time Mode</label>
              <div class="board-control-buttons">
                {[TIME_MODE.AUTO, TIME_MODE.AM, TIME_MODE.PM].map(mode => (
                  <button
                    key={mode}
                    class={`board-control-option ${boardStore.configured_mode.value === mode ? 'active' : ''}`}
                    onClick={() => changeTimeMode(mode)}
                    data-testid={`time-mode-${mode.toLowerCase()}`}
                    title={TIME_MODE_CONFIG[mode].description}
                  >
                    {TIME_MODE_CONFIG[mode].label}
                  </button>
                ))}
              </div>
            </div>

            <div class="board-control-group" data-testid="zoom-selector">
              <label class="board-control-label">Zoom</label>
              <div class="board-control-buttons">
                <button
                  class={`board-control-option ${boardStore.zoom_level.value === 1 ? 'active' : ''}`}
                  onClick={() => changeZoom(1)}
                  data-testid="zoom-level-1"
                >
                  S
                </button>
                <button
                  class={`board-control-option ${boardStore.zoom_level.value === 2 ? 'active' : ''}`}
                  onClick={() => changeZoom(2)}
                  data-testid="zoom-level-2"
                >
                  M
                </button>
                <button
                  class={`board-control-option ${boardStore.zoom_level.value === 3 ? 'active' : ''}`}
                  onClick={() => changeZoom(3)}
                  data-testid="zoom-level-3"
                >
                  L
                </button>
              </div>
            </div>

            <div class="board-control-group" data-testid="orientation-toggle">
              <label class="board-control-label">Orientation</label>
              <div class="board-control-buttons">
                <button
                  class={`board-control-option ${boardStore.orientation.value === 'horse-major' ? 'active' : ''}`}
                  onClick={() => changeOrientation('horse-major')}
                  data-testid="orientation-horse-major"
                >Horses</button>
                <button
                  class={`board-control-option ${boardStore.orientation.value === 'feed-major' ? 'active' : ''}`}
                  onClick={() => changeOrientation('feed-major')}
                  data-testid="orientation-feed-major"
                >Feeds</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
