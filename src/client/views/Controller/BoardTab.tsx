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
  const matchTV = useSignal(false);
  const showOverflow = useSignal(false);

  // Local state for independent viewing
  const localTimeMode = useSignal<'AM' | 'PM'>('AM'); // Defaults will be synced on mount/match-off
  const localOrientation = useSignal<BoardOrientation>('horse-major');

  // Sync local state to board when enabling independent mode (unmatching)
  // or on initial load if needed (though we can just default to board values)
  // Actually, simpler:
  // Effective values used for rendering the grid:
  const effectiveTimeMode = matchTV.value ? boardStore.effective_time_mode.value : localTimeMode.value;
  const effectiveOrientation = matchTV.value ? boardStore.orientation.value : localOrientation.value;

  // Initialize local state from board when component mounts
  // or when switching matchTV off? 
  // For now, let's just initialize signals with current board values.
  // We can't do this in render easily without effects, but signals are fine.
  // Let's use an effect to sync ONE WAY when matchTV is enabled? 
  // No, if matchTV is enabled, we just read from boardStore.
  // When matchTV *becomes* disabled, it might be nice to start from current board state.
  // We can handle that in the toggle handler.

  const toggleMatchTV = () => {
    const newValue = !matchTV.value;
    if (!newValue) {
      // Switching TO independent mode: copy current board state
      localTimeMode.value = boardStore.effective_time_mode.value;
      localOrientation.value = boardStore.orientation.value;
    }
    matchTV.value = newValue;
  };

  const toggleLocalTimeMode = () => {
    localTimeMode.value = localTimeMode.value === TIME_MODE.AM ? TIME_MODE.PM : TIME_MODE.AM;
  };

  const toggleLocalOrientation = () => {
    localOrientation.value = localOrientation.value === 'horse-major' ? 'feed-major' : 'horse-major';
  };

  return (
    <div class="board-tab" data-testid="board-tab">
      <div class="board-tab-header">
        <h2 class="board-tab-title">Board Preview</h2>

        {!matchTV.value && (
          <div class="header-controls">
            <button
              class="header-control-btn"
              onClick={toggleLocalTimeMode}
              data-testid="header-time-toggle"
            >
              {effectiveTimeMode}
            </button>
            <button
              class="header-control-btn"
              onClick={toggleLocalOrientation}
              data-testid="header-flip-btn"
              title="Flip Orientation"
            >
              ⇄
            </button>
          </div>
        )}

        {matchTV.value && (
          <span class="board-tab-badge">{effectiveTimeMode}</span>
        )}
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
        <span class="board-label-text">{matchTV.value ? 'Synced with TV' : 'Independent View'}</span>
      </div>

      <div class="board-preview">
        {(() => {
          const grid = computeGrid({
            horses: horseStore.items.value,
            feeds: feedStore.items.value,
            diet: dietStore.items.value,
            orientation: effectiveOrientation,
            timeMode: effectiveTimeMode,
            page: 0,
            pageSize: Infinity, // Unpaginated for infinite scroll
          });

          return (
            <SwimLaneGrid
              columns={grid.columns}
              rows={grid.rows}
              cells={grid.cells}
              isEditable={false}
            />
          );
        })()}
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
            <div class="board-control-group">
              <div class="match-tv-control">
                <label class="switch" data-testid="match-tv-toggle">
                  <input
                    type="checkbox"
                    checked={matchTV.value}
                    onChange={toggleMatchTV}
                  />
                  <span class="slider round"></span>
                </label>
                <span class="match-tv-label">Match TV Display</span>
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

            <button
              class="overflow-menu-btn"
              onClick={() => showOverflow.value = !showOverflow.value}
              data-testid="overflow-menu-btn"
            >
              ⋮
            </button>

            {showOverflow.value && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
