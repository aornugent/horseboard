import { user, isAuthLoading, permission, authClient } from '../../../stores';
import { isAdmin } from '../../../hooks/useAppMode';
import { navigate } from '../../../router';

async function handleSignOut() {
    await authClient.signOut();
    window.location.reload();
}

export function SectionAccount() {
    return (
        <section class="section">
            <h3 class="section-title">Account</h3>
            {isAuthLoading.value && (
                <div class="card">
                    <span class="info-label">Loading...</span>
                </div>
            )}
            {!isAuthLoading.value && user.value && (
                <div class="card u-flex-col u-gap-md">
                    <div class="u-flex-col u-gap-xs">
                        <span class="info-value" data-testid="account-name">{user.value.name}</span>
                        <span class="info-label">{user.value.email}</span>
                        <span class="list-card-badge">
                            {isAdmin.value ? 'Owner' : `Permission: ${permission.value}`}
                        </span>
                    </div>
                    <button
                        class="btn-danger btn-block"
                        onClick={handleSignOut}
                        data-testid="sign-out-btn"
                    >
                        Sign Out
                    </button>
                </div>
            )}
            {!isAuthLoading.value && !user.value && (
                <div class="card u-flex-col u-gap-md">
                    <span class="info-label">Not signed in</span>
                    <button
                        class="btn-block"
                        onClick={() => navigate('/login')}
                        data-testid="sign-in-btn"
                    >
                        Sign In
                    </button>
                </div>
            )}
        </section>
    );
}
