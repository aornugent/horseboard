import { SwimLaneGrid } from '../components/SwimLaneGrid/SwimLaneGrid';
import {
  horses, feeds, diet,
  orientation, pageSize, rowPageSize, current_page, effective_time_mode, board
} from '../stores';
import { computeGrid, get2DPageCoords } from '../../shared/grid-logic';


export function Board() {
  /* Pagination Logic */
  const activeHorses = horses.value.filter(h => !h.archived);
  const feedItems = feeds.value;
  const currentOrientation = orientation.value;

  const primaryCount = currentOrientation === 'horse-major' ? activeHorses.length : feedItems.length;
  const secondaryCount = currentOrientation === 'horse-major' ? feedItems.length : activeHorses.length;
  const currentRowPageSize = rowPageSize.value || 10;

  const totalRowPages = Math.ceil(secondaryCount / currentRowPageSize) || 1;
  const totalColPages = Math.ceil(primaryCount / (pageSize.value || 6)) || 1;
  const totalPages = totalColPages * totalRowPages;

  // Calculate 2D coordinates from linear page index
  const { columnPage, rowPage } = get2DPageCoords(
    current_page.value || 0,
    totalRowPages
  );

  const grid = computeGrid({
    horses: horses.value,
    feeds: feeds.value,
    diet: diet.value,
    orientation: orientation.value,
    timeMode: effective_time_mode.value,
    page: columnPage,
    pageSize: pageSize.value,
    rowPage: rowPage,
    rowPageSize: rowPageSize.value
  });

  const pairCode = board.value?.pair_code;
  const hasData = grid.columns.length > 0;

  /* Badge Rendering Uses Calculated Values */
  const currentPageIndex = (current_page.value || 0) + 1;

  return (
    <div
      class="board-view"
      data-theme={effective_time_mode.value.toLowerCase()}
      data-testid="board-view"
    >
      <header class="board-header">
        {pairCode && (
          <div class="board-pair-code" data-testid="board-pair-code">
            <span class="board-pair-code-label">Code:</span>
            <span class="board-pair-code-value">{pairCode}</span>
          </div>
        )}
        <div class="board-badges">
          <div class="board-page-badge" data-testid="page-badge">
            Page {currentPageIndex} / {totalPages}
          </div>
          <div class="board-time-badge" data-testid="time-mode-badge">
            {effective_time_mode.value}
          </div>
        </div>
      </header>

      <main class="board-content">
        {hasData ? (
          <>
            <SwimLaneGrid
              columns={grid.columns}
              rows={grid.rows}
              cells={grid.cells}
              isEditable={false}
            />
            {grid.hasMoreRows && (
              <div class="breadcrumb-more" data-testid="breadcrumb-more">
                ↓ {grid.remainingRows} more feeds below
              </div>
            )}
          </>
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
