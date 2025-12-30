import {
  board,
  configuredMode,
  effectiveTimeMode,
  zoomLevel,
  timezone,
  updateTimeMode,
  setZoomLevel,
  user,
  authClient,
  ownership,
} from '../../stores';
import { updateTimeMode as apiUpdateTimeMode, updateBoard as apiUpdateBoard } from '../../services';
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

  try {
    await apiUpdateTimeMode(board.value.id, mode, override_until);
    updateTimeMode(mode, override_until);
  } catch (err) {
    console.error('Failed to update time mode:', err);
  }
}

async function saveZoomLevel(level: 1 | 2 | 3) {
  if (!board.value) return;

  try {
    await apiUpdateBoard(board.value.id, { zoom_level: level });
    setZoomLevel(level);
  } catch (err) {
    console.error('Failed to update zoom level:', err);
  }
}

async function saveTimezone(tz: string) {
  if (!board.value) return;

  try {
    await apiUpdateBoard(board.value.id, { timezone: tz });
    board.value = { ...board.value, timezone: tz, updated_at: new Date().toISOString() };
  } catch (err) {
    console.error('Failed to update timezone:', err);
  }
}

async function handleSignOut() {
  await authClient.signOut();
  window.location.reload();
}

function handleNavigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('popstate'));
}

export function SettingsTab() {
  const canEdit = ['edit', 'admin'].includes(ownership.value.permission);

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

      {/* Account Section */}
      <section class="settings-section">
        <h3 class="settings-section-title">Account</h3>
        {user.value ? (
          <div class="settings-account-info">
            <div class="settings-account-details">
              <div class="settings-account-name" data-testid="account-name">{user.value.name}</div>
              <div class="settings-account-email">{user.value.email}</div>
              <div class="settings-account-role">
                {ownership.value.is_owner ? 'Owner' : `Permission: ${ownership.value.permission}`}
              </div>
            </div>
            <button
              class="settings-btn settings-btn-danger"
              onClick={handleSignOut}
              data-testid="sign-out-btn"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div class="settings-account-actions">
            <p class="settings-section-description">
              Sign in to manage this board.
            </p>
            <div class="settings-button-group">
              <button
                class="settings-btn"
                onClick={() => handleNavigate('/login')}
              >
                Sign In
              </button>
              <button
                class="settings-btn"
                onClick={() => handleNavigate('/signup')}
              >
                Sign Up
              </button>
            </div>
          </div>
        )}
      </section>

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
              onClick={() => canEdit && saveTimeMode(mode.value)}
              disabled={!canEdit}
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
              onClick={() => canEdit && saveZoomLevel(level.value)}
              disabled={!canEdit}
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
            disabled={!canEdit}
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
