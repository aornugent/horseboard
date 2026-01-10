import { SwimLaneGrid } from '../../components/SwimLaneGrid/SwimLaneGrid';
import {
  horses, feeds, diet, board,
  orientation, zoom_level, current_page, effective_time_mode, configured_mode,
  pageSize, rowPageSize,
  setCurrentPage, updateBoard, setZoomLevel, setOrientation
} from '../../stores';

import { updateBoard as apiUpdateBoard, updateTimeMode as apiUpdateTimeMode, updateOrientation as apiUpdateOrientation } from '../../services';
import { TIME_MODE, TIME_MODE_CONFIG, type TimeMode, type BoardOrientation } from '../../../shared/resources';
import { useSignal } from '@preact/signals';
import { computeGrid, get2DPageCoords } from '../../../shared/grid-logic';


async function changePage(delta: number) {
  if (!board.value) return;
  const newPage = Math.max(0, (current_page.value || 0) + delta);
  try {
    await apiUpdateBoard(board.value.id, { current_page: newPage });
    setCurrentPage(newPage);
  } catch (err) {
    console.error('Failed to update page:', err);
  }
}

async function changeTimeMode(mode: TimeMode) {
  if (!board.value) return;

  // Calculate override expiry (1 hour) for non-AUTO modes, matching SettingsTab behavior
  const override_until = mode !== TIME_MODE.AUTO
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : null;

  try {
    await apiUpdateTimeMode(board.value.id, mode, override_until);
    // Directly update the store via updateBoard helper
    updateBoard({ time_mode: mode, override_until });
  } catch (err) {
    console.error('Failed to update time mode:', err);
  }
}

async function changeZoom(level: 1 | 2 | 3) {
  if (!board.value) return;
  try {
    await apiUpdateBoard(board.value.id, { zoom_level: level });
    setZoomLevel(level);
  } catch (err) {
    console.error('Failed to update zoom:', err);
  }
}

async function changeOrientation(orientation: BoardOrientation) {
  if (!board.value) return;
  try {
    await apiUpdateOrientation(board.value.id, orientation);
    setOrientation(orientation);
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
  const effectiveTimeMode = matchTV.value ? effective_time_mode.value : localTimeMode.value;
  const effectiveOrientation = matchTV.value ? orientation.value : localOrientation.value;

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
      localTimeMode.value = effective_time_mode.value;
      localOrientation.value = orientation.value;
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
    <div class="tab" data-testid="board-tab">
      <div class="tab-header">
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
              <span class="flip-icon">↻</span>
            </button>
          </div>
        )}

        {matchTV.value && (
          <span class="tab-badge">{effectiveTimeMode}</span>
        )}
      </div>

      <div
        class="board-view-container"
        data-testid="board-view-container"
        onClick={() => { if (showControls.value) showControls.value = false; }}
      >
        {(() => {
          // Calculate pagination params based on matchTV mode
          const activeHorses = horses.value.filter(h => !h.archived);
          const feedItems = feeds.value;
          const currentPageSize = matchTV.value ? pageSize.value : Infinity;
          const currentRowPageSize = matchTV.value ? rowPageSize.value : Infinity;

          // Calculate total pages for 2D pagination (same logic as Board.tsx)
          const secondaryCount = effectiveOrientation === 'horse-major' ? feedItems.length : activeHorses.length;
          const totalRowPages = matchTV.value ? (Math.ceil(secondaryCount / currentRowPageSize) || 1) : 1;

          // Calculate 2D coordinates from linear page index
          const { columnPage, rowPage } = matchTV.value
            ? get2DPageCoords(current_page.value || 0, totalRowPages)
            : { columnPage: 0, rowPage: 0 };

          const grid = computeGrid({
            horses: horses.value,
            feeds: feeds.value,
            diet: diet.value,
            orientation: effectiveOrientation,
            timeMode: effectiveTimeMode,
            page: columnPage,
            pageSize: currentPageSize,
            rowPage: rowPage,
            rowPageSize: currentRowPageSize,
          });

          // Store totalPages in a way we can access in pagination controls
          // We'll use a computed approach directly in the JSX
          return (
            <>
              <SwimLaneGrid
                columns={grid.columns}
                rows={grid.rows}
                cells={grid.cells}
                isEditable={false}
              />
              {matchTV.value && grid.hasMoreRows && (
                <div class="breadcrumb-more" data-testid="breadcrumb-more">
                  ↓ {grid.remainingRows} more below
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Toggle button at bottom (when drawer closed) */}
      {!showControls.value && (
        <button
          class="tv-controls-toggle"
          onClick={() => showControls.value = true}
          data-testid="toggle-display-controls"
        >
          <span class="tv-controls-label">TV Controls ▲</span>
        </button>
      )}

      {/* Inline drawer - in normal flow */}
      <div
        class={`display-controls-drawer ${showControls.value ? 'open' : ''}`}
        data-testid="display-controls-drawer"
      >
        {/* Hero Pagination - Primary control */}
        {(() => {
          // Calculate total pages for pagination display and button state
          const activeHorses = horses.value.filter(h => !h.archived);
          const feedItems = feeds.value;
          const currentPageSize = pageSize.value;
          const currentRowPageSize = rowPageSize.value;
          const currentOrientation = orientation.value;

          const primaryCount = currentOrientation === 'horse-major' ? activeHorses.length : feedItems.length;
          const secondaryCount = currentOrientation === 'horse-major' ? feedItems.length : activeHorses.length;
          const totalRowPages = Math.ceil(secondaryCount / currentRowPageSize) || 1;
          const totalColPages = Math.ceil(primaryCount / currentPageSize) || 1;
          const totalPages = totalColPages * totalRowPages;
          const currentPageNum = (current_page.value || 0) + 1;
          const isLastPage = currentPageNum >= totalPages;

          return (
            <div class="tv-pagination-hero" data-testid="tv-pagination">
              <button
                class="icon-btn icon-btn--xl"
                onClick={() => changePage(-1)}
                disabled={(current_page.value || 0) <= 0}
                data-testid="tv-prev-page"
              >◀</button>
              <span class="tv-page-indicator" data-testid="page-indicator">
                {currentPageNum} / {totalPages}
              </span>
              <button
                class="icon-btn icon-btn--xl"
                onClick={() => changePage(1)}
                disabled={isLastPage}
                data-testid="tv-next-page"
              >▶</button>
            </div>
          );
        })()}

        {/* Secondary Row: Time Mode + Match TV + Overflow */}
        <div class="tv-controls-row">
          <div class="segmented-control segmented-control--invert" data-testid="time-mode-selector">
            {[TIME_MODE.AM, TIME_MODE.PM].map(mode => (
              <button
                key={mode}
                class={`segment-btn ${configured_mode.value === mode ? 'active' : ''}`}
                onClick={() => changeTimeMode(mode)}
                data-testid={`time-mode-${mode.toLowerCase()}`}
              >
                {TIME_MODE_CONFIG[mode].label}
              </button>
            ))}
          </div>

          <div class="match-tv-control">
            <label class="switch" data-testid="match-tv-toggle">
              <input
                type="checkbox"
                checked={matchTV.value}
                onChange={toggleMatchTV}
              />
              <span class="slider round"></span>
            </label>
            <span class="match-tv-label">Match</span>
          </div>

          <button
            class="icon-btn icon-btn--ghost"
            onClick={() => showOverflow.value = !showOverflow.value}
            data-testid="overflow-menu-btn"
          >
            ⚙
          </button>
        </div>

        {/* Overflow: Orientation + Zoom */}
        {showOverflow.value && (
          <>
            <div class="board-control-group" data-testid="orientation-toggle">
              <label class="board-control-label">Orientation</label>
              <div class="segmented-control">
                <button
                  class={`segment-btn ${orientation.value === 'horse-major' ? 'active' : ''}`}
                  onClick={() => changeOrientation('horse-major')}
                  data-testid="orientation-horse-major"
                >Horses</button>
                <button
                  class={`segment-btn ${orientation.value === 'feed-major' ? 'active' : ''}`}
                  onClick={() => changeOrientation('feed-major')}
                  data-testid="orientation-feed-major"
                >Feeds</button>
              </div>
            </div>

            <div class="board-control-group" data-testid="zoom-selector">
              <label class="board-control-label">Zoom</label>
              <div class="segmented-control">
                <button
                  class={`segment-btn ${zoom_level.value === 1 ? 'active' : ''}`}
                  onClick={() => changeZoom(1)}
                  data-testid="zoom-level-1"
                >S</button>
                <button
                  class={`segment-btn ${zoom_level.value === 2 ? 'active' : ''}`}
                  onClick={() => changeZoom(2)}
                  data-testid="zoom-level-2"
                >M</button>
                <button
                  class={`segment-btn ${zoom_level.value === 3 ? 'active' : ''}`}
                  onClick={() => changeZoom(3)}
                  data-testid="zoom-level-3"
                >L</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
