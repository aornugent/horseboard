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
                            {isAdmin.value ? 'Owner' : `Permission: ${permission.value}`}
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
    );
}
