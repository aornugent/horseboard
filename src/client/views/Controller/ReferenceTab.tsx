import { SwimLaneGrid } from '../../components/SwimLaneGrid/SwimLaneGrid';
import { horseStore, feedStore, boardStore, dietStore } from '../../stores';
import { computeGrid } from '../../../shared/grid-logic';
import './BoardTab.css'; // Reuse BoardTab styling for now

export function ReferenceTab() {
    const grid = computeGrid({
        horses: horseStore.items.value,
        feeds: feedStore.items.value,
        diet: dietStore.items.value,
        orientation: boardStore.orientation.value,
        timeMode: boardStore.effective_time_mode.value,
        page: 0,
        pageSize: Infinity, // Unpaginated
        rowPage: 0,
        rowPageSize: Infinity // Unpaginated
    });

    return (
        <div class="board-tab" data-testid="reference-tab">
            <div class="board-tab-header">
                <h2 class="board-tab-title">Reference View</h2>
                <span class="board-tab-badge">{boardStore.effective_time_mode.value}</span>
            </div>

            <div class="board-label">
                <span class="board-label-text">Full List (Unpaginated)</span>
            </div>

            <div
                class="board-preview"
                data-theme={boardStore.effective_time_mode.value.toLowerCase()}
                style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }} // Allow scrolling
            >
                <div class="board-preview-content">
                    <SwimLaneGrid
                        columns={grid.columns}
                        rows={grid.rows}
                        cells={grid.cells}
                        isEditable={false}
                    />
                </div>
            </div>
        </div>
    );
}
