import {
    generateInviteCode,
    redeemInvite
} from '../../../services';
import { board } from '../../../stores';
import { useSignal } from '@preact/signals';

// Note: generateInviteCode is from API/Services.
// But we need to verify where generateInviteCode comes from.
// In SettingsTab.tsx it was imported from '../../services'.

export function SectionPermissions() {
    return (
        <section class="section">
            <h3 class="section-title">Permissions</h3>
            <SectionStaffAccess />
        </section>
    );
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

export function SectionUpgradeAccess() {
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
