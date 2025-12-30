import { signal } from '@preact/signals';
import { authClient } from '../stores';
import './Auth.css';

const email = signal('');
const password = signal('');
const error = signal<string | null>(null);
const isLoading = signal(false);

export function LoginView() {
    const handleLogin = async (e: Event) => {
        e.preventDefault();
        error.value = null;
        isLoading.value = true;

        try {
            const { data, error: authError } = await authClient.signIn.email({
                email: email.value,
                password: password.value,
            });

            if (authError) {
                // Better Auth might return specific error codes, but message is usually human readable
                error.value = authError.message || 'Invalid email or password';
            } else if (data) {
                // Successful login
                window.location.href = '/controller'; // Redirect to controller
            }
        } catch (err) {
            error.value = (err as any)?.message || 'An unexpected error occurred';
            console.error(err);
        } finally {
            isLoading.value = false;
        }
    };

    return (
        <div class="auth-container" data-testid="login-view">
            <div class="auth-card">
                <div class="auth-header">
                    <h1 class="auth-title">Welcome Back</h1>
                    <p class="auth-subtitle">Sign in to manage your stable</p>
                </div>

                <form class="auth-form" onSubmit={handleLogin}>
                    <div class="form-group">
                        <label class="form-label" for="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            class="form-input"
                            data-testid="email-input"
                            value={email.value}
                            onInput={(e) => (email.value = (e.target as HTMLInputElement).value)}
                            placeholder="alice@example.com"
                            required
                            disabled={isLoading.value}
                        />
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            class="form-input"
                            data-testid="password-input"
                            value={password.value}
                            onInput={(e) => (password.value = (e.target as HTMLInputElement).value)}
                            placeholder="••••••••"
                            required
                            disabled={isLoading.value}
                        />
                    </div>

                    {error.value && (
                        <div class="auth-error">
                            {error.value}
                        </div>
                    )}

                    <button
                        type="submit"
                        class="submit-btn"
                        data-testid="submit-btn"
                        disabled={isLoading.value}
                    >
                        {isLoading.value ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div class="auth-footer">
                    Don't have an account?
                    <a href="/signup" class="auth-link" onClick={(e) => {
                        e.preventDefault();
                        window.history.pushState({}, '', '/signup');
                        window.dispatchEvent(new Event('popstate'));
                    }}>Sign Up</a>
                </div>
            </div>
        </div>
    );
}
