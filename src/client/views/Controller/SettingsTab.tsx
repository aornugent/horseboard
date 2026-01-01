import {
  board,
  timezone,
  user,
  authClient,
  ownership,
} from '../../stores';
import { updateBoard as apiUpdateBoard, redeemInvite } from '../../services';
import { LinkDisplayModal } from '../../components/LinkDisplayModal';
import { listDevices, revokeDeviceToken } from '../../services';
import {
  listControllerTokens,
  createControllerToken,
  revokeControllerToken,
  type ControllerToken
} from '../../services';
import { Modal } from '../../components/Modal';
import { useSignal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
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

function handleNavigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('popstate'));
}

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
    <section class="settings-section">
      <h3 class="settings-section-title">Staff Access</h3>
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
            class="settings-btn"
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
    </section>
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
  const [showTokens, setShowTokens] = useState(false);
  const [tokens, setTokens] = useState<ControllerToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenPermission, setTokenPermission] = useState<'view' | 'edit'>('view');
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);

  useEffect(() => {
    if (showTokens && !loadingTokens && tokens.length === 0) {
      loadTokens();
    }
  }, [showTokens]);

  async function loadTokens() {
    if (!board.value) return;
    try {
      setLoadingTokens(true);
      const data = await listControllerTokens(board.value.id);
      setTokens(data);
    } catch (err) {
      console.error('Failed to load tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  }

  async function handleCreateToken(e: Event) {
    e.preventDefault();
    if (!board.value || !tokenName) return;

    try {
      setCreating(true);
      const result = await createControllerToken(
        board.value.id,
        tokenName,
        tokenPermission
      );
      setNewToken(result.token);
      await loadTokens();
    } catch (err) {
      console.error('Failed to create token:', err);
      alert('Failed to create token');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeToken(id: string) {
    if (!confirm('Are you sure you want to revoke this token? It will stop working immediately.')) {
      return;
    }

    try {
      setRevokingId(id);
      await revokeControllerToken(id);
      await loadTokens();
    } catch (err) {
      console.error('Failed to revoke token:', err);
      alert('Failed to revoke token');
    } finally {
      setRevokingId(null);
    }
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setNewToken(null);
    setTokenName('');
    setTokenPermission('view');
  }

  function copyToken() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      alert('Token copied to clipboard!');
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <section class="settings-section">
      <h3 class="settings-section-title">Permissions</h3>

      <div class="settings-permissions-subsection">
        <h4 class="settings-subsection-title">Staff Access</h4>
        <p class="settings-section-description">
          Generate a temporary code to give staff 'Edit' access
        </p>
        <SectionStaffAccess />
      </div>

      <div class="settings-permissions-subsection">
        <h4 class="settings-subsection-title">API Tokens (Advanced)</h4>
        <p class="settings-section-description">
          For developers and integrations
        </p>

        {!showTokens ? (
          <button
            class="settings-btn settings-btn-block"
            onClick={() => setShowTokens(true)}
          >
            Show API Tokens
          </button>
        ) : (
          <>
            {loadingTokens && tokens.length === 0 ? (
              <div class="settings-empty-state">Loading tokens...</div>
            ) : tokens.length === 0 ? (
              <div class="settings-empty-state">
                <p>No API tokens created yet.</p>
              </div>
            ) : (
              <div class="settings-tokens-list">
                {tokens.map(token => (
                  <div class="settings-token-item" key={token.id}>
                    <div class="settings-token-info">
                      <span class="settings-token-name">{token.name}</span>
                      <div class="settings-token-details">
                        <span class={`settings-token-badge ${token.permission}`}>
                          {token.permission}
                        </span>
                        <span>Created: {formatDate(token.created_at)}</span>
                        <span>Used: {formatDate(token.last_used_at)}</span>
                      </div>
                    </div>
                    <button
                      class="settings-btn settings-btn-danger settings-btn-small"
                      disabled={revokingId === token.id}
                      onClick={() => handleRevokeToken(token.id)}
                    >
                      {revokingId === token.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              class="settings-btn settings-btn-primary settings-btn-block"
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="create-token-btn"
            >
              Create Token
            </button>

            <button
              class="settings-btn settings-btn-text"
              onClick={() => setShowTokens(false)}
            >
              Hide API Tokens
            </button>
          </>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={newToken ? "Token Created" : "Create Controller Token"}
      >
        {newToken ? (
          <div class="settings-token-display">
            <p>This is the only time you will see this token.</p>
            <div class="settings-token-value">{newToken}</div>
            <button class="settings-btn settings-btn-block" onClick={copyToken}>
              Copy to Clipboard
            </button>
            <p class="settings-warning-text">
              Store this token safely. It grants access to your board.
            </p>
            <div class="settings-form-actions">
              <button class="settings-btn settings-btn-primary settings-btn-block" onClick={closeCreateModal}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form class="settings-token-form" onSubmit={handleCreateToken}>
            <div class="settings-form-group">
              <label class="settings-form-label">Token Name</label>
              <input
                type="text"
                class="settings-input"
                placeholder="e.g. Barn iPad, Staff Phone"
                value={tokenName}
                onInput={(e) => setTokenName((e.target as HTMLInputElement).value)}
                required
              />
            </div>

            <div class="settings-form-group">
              <label class="settings-form-label">Permission Level</label>
              <select
                class="settings-select"
                value={tokenPermission}
                onChange={(e) => setTokenPermission((e.target as HTMLSelectElement).value as 'view' | 'edit')}
              >
                <option value="view">View Only (Read-only)</option>
                <option value="edit">Edit (Full Control)</option>
              </select>
            </div>

            <div class="settings-form-actions">
              <button
                type="button"
                class="settings-btn"
                onClick={closeCreateModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="settings-btn settings-btn-primary"
                disabled={creating || !tokenName}
              >
                {creating ? 'Creating...' : 'Create Token'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

export function SettingsTab() {
  const canEdit = ['edit', 'admin'].includes(ownership.value.permission);
  const showLinkModal = useSignal(false);
  const linkedDevices = useSignal<any[]>([]);

  useEffect(() => {
    if (canEdit && ownership.value.is_owner) {
      listDevices().then(d => linkedDevices.value = d).catch(console.error);
    }
  }, [canEdit, ownership.value.is_owner]);

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

      {!canEdit && <SectionUpgradeAccess />}

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

      {ownership.value.is_owner && (
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
                  disabled={!canEdit}
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
