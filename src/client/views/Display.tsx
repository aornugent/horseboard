import { SwimLaneGrid } from '../components/SwimLaneGrid';
import { horses, feeds, effectiveTimeMode } from '../stores';
import './Display.css';

export function Display() {
  return (
    <div
      class="display-view"
      data-theme={effectiveTimeMode.value.toLowerCase()}
      data-testid="display-view"
    >
      <header class="display-header">
        <div class="display-time-badge" data-testid="time-mode-badge">
          {effectiveTimeMode.value}
        </div>
      </header>

      <main class="display-content">
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
