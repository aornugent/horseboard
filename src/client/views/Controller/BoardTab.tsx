import { SwimLaneGrid } from '../../components/SwimLaneGrid';
import { horses, feeds, effectiveTimeMode } from '../../stores';
import './BoardTab.css';

import { updateBoard as apiUpdateBoard } from '../../services';
import { board, setCurrentPage, currentPage } from '../../stores';

async function changePage(delta: number) {
  if (!board.value) return;
  const newPage = Math.max(0, (currentPage.value || 0) + delta);
  try {
    await apiUpdateBoard(board.value.id, { current_page: newPage });
    setCurrentPage(newPage);
  } catch (err) {
    console.error('Failed to update page:', err);
  }
}

export function BoardTab() {
  return (
    <div class="board-tab" data-testid="board-tab">
      <div class="board-tab-header">
        <h2 class="board-tab-title">Board Preview</h2>
        <span class="board-tab-badge">{effectiveTimeMode.value}</span>
      </div>

      <div class="board-controls">
        <button
          class="board-control-btn"
          onClick={() => changePage(-1)}
          disabled={(currentPage.value || 0) <= 0}
          data-testid="prev-page-btn"
        >
          Allocations
        </button>
        <span class="board-page-indicator">Page {(currentPage.value || 0) + 1}</span>
        <button
          class="board-control-btn"
          onClick={() => changePage(1)}
          data-testid="next-page-btn"
        >
          Next Page
        </button>
      </div>

      <div class="board-label">
        <span class="board-label-text">Read-Only TV Preview</span>
      </div>

      <div
        class="board-preview"
        data-theme={effectiveTimeMode.value.toLowerCase()}
      >
        <div class="board-preview-content">
          <SwimLaneGrid
            horses={horses}
            feeds={feeds}
            timeMode={effectiveTimeMode}
            isEditable={false}
          />
        </div>
      </div>
    </div>
  );
}
