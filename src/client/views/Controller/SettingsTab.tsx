import {
  board,
  timezone,
  orientation,
  zoom_level,
  updateBoard,
  setOrientation,
  setZoomLevel,
  user,
  authClient,
  permission,
  isAdmin,
  canEdit,
  isAuthLoading,
} from '../../stores';
import { navigate } from '../../router';
import { updateBoard as apiUpdateBoard, redeemInvite } from '../../services';
import { LinkDisplayModal } from '../../components/LinkDisplayModal';
import { listDevices, revokeDeviceToken } from '../../services';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';


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

async function saveTimezone(tz: string) {
  if (!board.value) return;

  try {
    await apiUpdateBoard(board.value.id, { timezone: tz });
    updateBoard({ timezone: tz });
  } catch (err) {
    console.error('Failed to update timezone:', err);
  }
}

async function handleSignOut() {
  await authClient.signOut();
  window.location.reload();
}

import { updateOrientation as apiUpdateOrientation } from '../../services';

async function changeOrientation(orientation: 'horse-major' | 'feed-major') {
  if (!board.value) return;
  try {
    await apiUpdateOrientation(board.value.id, orientation);
    setOrientation(orientation);
  } catch (err) {
    console.error('Failed to update orientation:', err);
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

import { generateInviteCode } from '../../services';

function SectionStaffAccess() {
  const inviteCode = useSignal<{ code: string; expires_at: string } | null>(null);
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);

  async function handleGenerate() {
    if (!board.value) return;
    loading.value = true;
    error.value = null;
    try {
      inviteCode.value = await generateInviteCode(board.value.id);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  return (
    <>
      <h4 class="settings-subsection-title">Staff Access</h4>
      <p class="section-description">
        Generate a temporary code to give staff 'Edit' access
      </p>

      {inviteCode.value ? (
        <div class="settings-invite-result" data-testid="invite-code-display">
          <div class="settings-invite-code">{inviteCode.value.code}</div>
          <p class="settings-invite-expiry">
            Expires: {new Date(inviteCode.value.expires_at).toLocaleTimeString()}
          </p>
          <button
            class="btn-list btn-list-primary btn-list-block"
            onClick={() => inviteCode.value = null}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <button
            class="btn-list btn-list-primary btn-list-block"
            onClick={handleGenerate}
            disabled={loading.value}
            data-testid="generate-invite-btn"
          >
            {loading.value ? 'Generating...' : 'Generate Invite Code'}
          </button>
          {error.value && <p class="settings-error">{error.value}</p>}
        </>
      )}
    </>
  );
}

function SectionUpgradeAccess() {
  const showInput = useSignal(false);
  const code = useSignal('');
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);

  async function handleRedeem() {
    if (!code.value) return;
    loading.value = true;
    error.value = null;
    try {
      await redeemInvite(code.value);
      window.location.reload();
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  if (!showInput.value) {
    return (
      <section class="section">
        <h3 class="section-title">Upgrade Access</h3>
        <p class="section-description">
          Have an invite code? Enter it here to enable controls.
        </p>
        <button
          class="btn-list btn-list-primary btn-list-block"
          onClick={() => showInput.value = true}
          data-testid="enter-invite-btn"
        >
          Enter Invite Code
        </button>
      </section>
    );
  }

  return (
    <section class="section">
      <h3 class="section-title">Enter Invite Code</h3>
      <div class="input-group">
        <input
          type="text"
          class="input input-code"
          value={code.value}
          onInput={(e) => code.value = (e.target as HTMLInputElement).value}
          placeholder="000000"
          data-testid="invite-input"
        />
        <button
          class="btn-list btn-list-primary"
          onClick={handleRedeem}
          disabled={loading.value || !code.value}
          data-testid="invite-submit"
        >
          {loading.value ? 'Verifying...' : 'Submit'}
        </button>
      </div>
      {error.value && <p class="settings-error" data-testid="invite-error">{error.value}</p>}
      <button
        class="btn-list btn-list-text"
        onClick={() => showInput.value = false}
      >
        Cancel
      </button>
    </section>
  );
}

function SectionPermissions() {
  return (
    <section class="section">
      <h3 class="section-title">Permissions</h3>
      <SectionStaffAccess />
    </section>
  );
}

export function SettingsTab() {
  const canEditBoard = canEdit();
  const showLinkModal = useSignal(false);
  const linkedDevices = useSignal<any[]>([]);

  useEffect(() => {
    if (isAdmin()) {
      listDevices().then(d => linkedDevices.value = d).catch(console.error);
    }
  }, [permission.value]);

  async function handleUnlink(tokenId: string) {
    if (confirm('Are you sure you want to unlink this display?')) {
      await revokeDeviceToken(tokenId);
      linkedDevices.value = await listDevices();
    }
  }

  if (!board.value) {
    return (
      <div class="tab" data-testid="settings-tab">
        <div class="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div class="tab" data-testid="settings-tab">
      <h2 class="tab-title">Settings</h2>

      <section class="section">
        <h3 class="section-title">Account</h3>
        {isAuthLoading.value && (
          <div class="info-info">
            <div class="info-details">
              <div class="info-role">Loading...</div>
            </div>
          </div>
        )}
        {!isAuthLoading.value && user.value && (
          <div class="info-info">
            <div class="info-details">
              <div class="info-name" data-testid="account-name">{user.value.name}</div>
              <div class="info-email">{user.value.email}</div>
              <div class="info-role">
                {isAdmin() ? 'Owner' : `Permission: ${permission.value}`}
              </div>
            </div>
            <button
              class="btn-list btn-list-danger"
              onClick={handleSignOut}
              data-testid="sign-out-btn"
            >
              Sign Out
            </button>
          </div>
        )}
        {!isAuthLoading.value && !user.value && (
          <div class="info-info">
            <div class="info-details">
              <div class="info-role">Not signed in</div>
            </div>
            <button
              class="btn-list btn-list-primary"
              onClick={() => navigate('/login')}
              data-testid="sign-in-btn"
            >
              Sign In
            </button>
          </div>
        )}
      </section>

      {!canEditBoard && <SectionUpgradeAccess />}

      <section class="section info">
        <h3 class="section-title">Board Info</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Pair Code</span>
            <span class="info-value" data-testid="board-pair-code">
              {board.value.pair_code}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Board ID</span>
            <span class="info-value info-value-small" data-testid="board-id">
              {board.value.id.slice(0, 8)}...
            </span>
          </div>
        </div>
      </section>

      {isAdmin() && (
        <>
          <section class="section">
            <h3 class="section-title">Displays</h3>

            <div class="devices-list">
              {linkedDevices.value.length === 0 ? (
                <div class="settings-empty-state">No displays connected</div>
              ) : (
                linkedDevices.value.map(device => (
                  <div class="device-item" key={device.id}>
                    <div class="device-info">
                      <span class="device-name" data-testid="device-name">{device.name}</span>
                      <span class="device-meta">Added: {new Date(device.created_at).toLocaleDateString()}</span>
                    </div>
                    <button
                      class="btn-list btn-list-danger btn-list-small"
                      onClick={() => handleUnlink(device.id)}
                      data-testid="unlink-display-btn"
                    >
                      Unlink
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              class="btn-list btn-list-primary btn-list-block"
              onClick={() => showLinkModal.value = true}
              data-testid="add-display-btn"
            >
              Link New Display
            </button>

            <div class="settings-display-timezone">
              <h4 class="settings-subsection-title">Timezone</h4>
              <p class="section-description">
                Used for automatic AM/PM calculation
              </p>
              <div class="input-wrapper">
                <select
                  class="input"
                  data-testid="timezone-selector"
                  value={timezone.value}
                  onChange={(e) => saveTimezone((e.target as HTMLSelectElement).value)}
                  disabled={!canEditBoard}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <SectionPermissions />

          <section class="section" data-testid="display-defaults-section">
            <h3 class="section-title">Display Defaults</h3>
            <p class="section-description">
              Configure default orientation and zoom for TV displays
            </p>

            <div class="settings-control-group">
              <label class="settings-subsection-title">Default Orientation</label>
              <div class="settings-segmented" data-testid="default-orientation-selector">
                <button
                  class={orientation.value === 'horse-major' ? 'active' : ''}
                  onClick={() => changeOrientation('horse-major')}
                >
                  Horses
                </button>
                <button
                  class={orientation.value === 'feed-major' ? 'active' : ''}
                  onClick={() => changeOrientation('feed-major')}
                >
                  Feeds
                </button>
              </div>
            </div>

            <div class="settings-control-group">
              <label class="settings-subsection-title">Default Zoom</label>
              <div class="settings-segmented" data-testid="default-zoom-selector">
                <button class={zoom_level.value === 1 ? 'active' : ''} onClick={() => changeZoom(1)}>S</button>
                <button class={zoom_level.value === 2 ? 'active' : ''} onClick={() => changeZoom(2)}>M</button>
                <button class={zoom_level.value === 3 ? 'active' : ''} onClick={() => changeZoom(3)}>L</button>
              </div>
            </div>
          </section>
        </>
      )}

      {showLinkModal.value && (
        <LinkDisplayModal
          onClose={() => showLinkModal.value = false}
          onSuccess={() => listDevices().then(d => linkedDevices.value = d)}
        />
      )}
    </div >
  );
}
