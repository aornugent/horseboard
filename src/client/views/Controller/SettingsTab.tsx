import {
  board,
  timezone,
  user,
  authClient,
  permission,
  isAdmin,
  canEdit,
} from '../../stores';
import { updateBoard as apiUpdateBoard, redeemInvite } from '../../services';
import { LinkDisplayModal } from '../../components/LinkDisplayModal';
import { listDevices, revokeDeviceToken } from '../../services';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
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
      <p class="settings-section-description">
        Generate a temporary code to give staff 'Edit' access
      </p>

      {inviteCode.value ? (
        <div class="settings-invite-result" data-testid="invite-code-display">
          <div class="settings-invite-code">{inviteCode.value.code}</div>
          <p class="settings-invite-expiry">
            Expires: {new Date(inviteCode.value.expires_at).toLocaleTimeString()}
          </p>
          <button
            class="settings-btn settings-btn-primary settings-btn-block"
            onClick={() => inviteCode.value = null}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <button
            class="settings-btn settings-btn-primary settings-btn-block"
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
      <section class="settings-section">
        <h3 class="settings-section-title">Upgrade Access</h3>
        <p class="settings-section-description">
          Have an invite code? Enter it here to enable controls.
        </p>
        <button
          class="settings-btn settings-btn-primary settings-btn-block"
          onClick={() => showInput.value = true}
          data-testid="enter-invite-btn"
        >
          Enter Invite Code
        </button>
      </section>
    );
  }

  return (
    <section class="settings-section">
      <h3 class="settings-section-title">Enter Invite Code</h3>
      <div class="settings-input-group">
        <input
          type="text"
          class="settings-input settings-input-code"
          value={code.value}
          onInput={(e) => code.value = (e.target as HTMLInputElement).value}
          placeholder="000000"
          data-testid="invite-input"
        />
        <button
          class="settings-btn settings-btn-primary"
          onClick={handleRedeem}
          disabled={loading.value || !code.value}
          data-testid="invite-submit"
        >
          {loading.value ? 'Verifying...' : 'Submit'}
        </button>
      </div>
      {error.value && <p class="settings-error">{error.value}</p>}
      <button
        class="settings-btn settings-btn-text"
        onClick={() => showInput.value = false}
      >
        Cancel
      </button>
    </section>
  );
}

function SectionPermissions() {
  return (
    <section class="settings-section">
      <h3 class="settings-section-title">Permissions</h3>
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
      <div class="settings-tab" data-testid="settings-tab">
        <div class="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div class="settings-tab" data-testid="settings-tab">
      <h2 class="settings-title">Settings</h2>

      <section class="settings-section">
        <h3 class="settings-section-title">Account</h3>
        {user.value && (
          <div class="settings-account-info">
            <div class="settings-account-details">
              <div class="settings-account-name" data-testid="account-name">{user.value.name}</div>
              <div class="settings-account-email">{user.value.email}</div>
              <div class="settings-account-role">
                {isAdmin() ? 'Owner' : `Permission: ${permission.value}`}
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
        )}
      </section>

      {!canEditBoard && <SectionUpgradeAccess />}

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

      {isAdmin() && (
        <>
          <section class="settings-section">
            <h3 class="settings-section-title">Displays</h3>

            <div class="settings-devices-list">
              {linkedDevices.value.length === 0 ? (
                <div class="settings-empty-state">No displays connected</div>
              ) : (
                linkedDevices.value.map(device => (
                  <div class="settings-device-item" key={device.id}>
                    <div class="settings-device-info">
                      <span class="settings-device-name">{device.name}</span>
                      <span class="settings-device-meta">Added: {new Date(device.created_at).toLocaleDateString()}</span>
                    </div>
                    <button
                      class="settings-btn settings-btn-danger settings-btn-small"
                      onClick={() => handleUnlink(device.id)}
                    >
                      Unlink
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              class="settings-btn settings-btn-primary settings-btn-block"
              onClick={() => showLinkModal.value = true}
              data-testid="add-display-btn"
            >
              Link New Display
            </button>

            <div class="settings-display-timezone">
              <h4 class="settings-subsection-title">Timezone</h4>
              <p class="settings-section-description">
                Used for automatic AM/PM calculation
              </p>
              <div class="settings-select-wrapper">
                <select
                  class="settings-select"
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
