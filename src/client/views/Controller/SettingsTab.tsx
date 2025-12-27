import {
  board,
  configuredMode,
  effectiveTimeMode,
  zoomLevel,
  timezone,
  updateTimeMode,
  setZoomLevel,
} from '../../stores';
import {
  TIME_MODES,
  TIME_MODE,
  TIME_MODE_CONFIG,
  type TimeMode,
} from '@shared/resources';
import './SettingsTab.css';

// Common timezones for horse farms
const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC' },
];

// Generate time mode options from shared constants
const TIME_MODE_OPTIONS = TIME_MODES.map(mode => ({
  value: mode,
  ...TIME_MODE_CONFIG[mode],
}));

const ZOOM_LEVELS: Array<{ value: 1 | 2 | 3; label: string; description: string }> = [
  { value: 1, label: 'Small', description: 'More horses visible' },
  { value: 2, label: 'Medium', description: 'Balanced view' },
  { value: 3, label: 'Large', description: 'Easier to read' },
];

async function saveTimeMode(mode: TimeMode) {
  if (!board.value) return;

  const override_until = mode !== TIME_MODE.AUTO
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour override
    : null;

  const response = await fetch(`/api/boards/${board.value.id}/time-mode`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time_mode: mode, override_until }),
  });

  if (response.ok) {
    updateTimeMode(mode, override_until);
  }
}

async function saveZoomLevel(level: 1 | 2 | 3) {
  if (!board.value) return;

  const response = await fetch(`/api/boards/${board.value.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zoom_level: level }),
  });

  if (response.ok) {
    setZoomLevel(level);
  }
}

async function saveTimezone(tz: string) {
  if (!board.value) return;

  const response = await fetch(`/api/boards/${board.value.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timezone: tz }),
  });

  if (response.ok) {
    // Update board in store
    board.value = { ...board.value, timezone: tz, updated_at: new Date().toISOString() };
  }
}

export function SettingsTab() {
  if (!board.value) {
    return (
      <div class="settings-tab" data-testid="settings-tab">
        <div class="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div class="settings-tab" data-testid="settings-tab">
      <h2 class="settings-title">Settings</h2>

      {/* Time Mode Section */}
      <section class="settings-section">
        <h3 class="settings-section-title">Time Mode</h3>
        <p class="settings-section-description">
          Current: <strong data-testid="effective-time-mode">{effectiveTimeMode.value}</strong>
        </p>
        <div class="settings-button-group" data-testid="time-mode-selector">
          {TIME_MODE_OPTIONS.map(mode => (
            <button
              key={mode.value}
              class={`settings-btn ${configuredMode.value === mode.value ? 'active' : ''}`}
              data-testid={`time-mode-${mode.value.toLowerCase()}`}
              onClick={() => saveTimeMode(mode.value)}
            >
              <span class="settings-btn-label">{mode.label}</span>
              <span class="settings-btn-description">{mode.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Zoom Level Section */}
      <section class="settings-section">
        <h3 class="settings-section-title">Display Zoom</h3>
        <p class="settings-section-description">
          Adjust text size on the TV display
        </p>
        <div class="settings-button-group" data-testid="zoom-selector">
          {ZOOM_LEVELS.map(level => (
            <button
              key={level.value}
              class={`settings-btn ${zoomLevel.value === level.value ? 'active' : ''}`}
              data-testid={`zoom-level-${level.value}`}
              onClick={() => saveZoomLevel(level.value)}
            >
              <span class="settings-btn-label">{level.label}</span>
              <span class="settings-btn-description">{level.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Timezone Section */}
      <section class="settings-section">
        <h3 class="settings-section-title">Timezone</h3>
        <p class="settings-section-description">
          Used for automatic AM/PM calculation
        </p>
        <div class="settings-select-wrapper">
          <select
            class="settings-select"
            data-testid="timezone-selector"
            value={timezone.value}
            onChange={(e) => saveTimezone((e.target as HTMLSelectElement).value)}
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Board Info */}
      <section class="settings-section settings-info">
        <h3 class="settings-section-title">Board Info</h3>
        <div class="settings-info-grid">
          <div class="settings-info-item">
            <span class="settings-info-label">Pair Code</span>
            <span class="settings-info-value" data-testid="board-pair-code">
              {board.value.pair_code}
            </span>
          </div>
          <div class="settings-info-item">
            <span class="settings-info-label">Board ID</span>
            <span class="settings-info-value settings-info-value-small" data-testid="board-id">
              {board.value.id.slice(0, 8)}...
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
