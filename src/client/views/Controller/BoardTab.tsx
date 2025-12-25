import { SwimLaneGrid } from '../../components/SwimLaneGrid';
import { horses } from '../../stores/horses';
import { feeds } from '../../stores/feeds';
import { effectiveTimeMode } from '../../stores/display';
import './BoardTab.css';

export function BoardTab() {
  return (
    <div class="board-tab" data-testid="board-tab">
      <div class="board-tab-header">
        <h2 class="board-tab-title">Board Preview</h2>
        <span class="board-tab-badge">{effectiveTimeMode.value}</span>
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
