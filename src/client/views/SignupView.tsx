import { signal } from '@preact/signals';
import { authClient } from '../stores';
import './Auth.css';

const name = signal('');
const email = signal('');
const password = signal('');
const error = signal<string | null>(null);
const isLoading = signal(false);

export function SignupView() {
    const handleSignup = async (e: Event) => {
        e.preventDefault();
        error.value = null;
        isLoading.value = true;

        try {
            const { data, error: authError } = await authClient.signUp.email({
                name: name.value,
                email: email.value,
                password: password.value,
            });

            if (authError) {
                error.value = authError.message || 'Failed to sign up';
            } else if (data) {
                // Successful signup
                // Successful signup
                try {
                    const { listUserBoards, createBoard } = await import('../services');
                    const boards = await listUserBoards();
                    let boardId;
                    if (boards.length === 0) {
                        const newBoard = await createBoard();
                        boardId = newBoard.id;
                    } else {
                        boardId = boards[0].id;
                    }
                    localStorage.setItem('horseboard_board_id', boardId);
                } catch (e) {
                    console.error('Auto-setup failed:', e);
                }
                window.location.href = '/controller'; // Redirect to controller
            }
        } catch (err) {
            error.value = 'An unexpected error occurred';
            console.error(err);
        } finally {
            isLoading.value = false;
        }
    };

    return (
        <div class="auth-container" data-testid="signup-view">
            <div class="auth-card">
                <div class="auth-header">
                    <h1 class="auth-title">Create Account</h1>
                    <p class="auth-subtitle">Get started with HorseBoard</p>
                </div>

                <form class="auth-form" onSubmit={handleSignup}>
                    <div class="form-group">
                        <label class="form-label" for="name">Full Name</label>
                        <input
                            id="name"
                            type="text"
                            class="form-input"
                            data-testid="name-input"
                            value={name.value}
                            onInput={(e) => (name.value = (e.target as HTMLInputElement).value)}
                            placeholder="Alice Barnmanager"
                            required
                            disabled={isLoading.value}
                        />
                    </div>

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
                            minLength={8}
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
                        {isLoading.value ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <div class="auth-footer">
                    Already have an account?
                    <a href="/login" class="auth-link" onClick={(e) => {
                        e.preventDefault();
                        window.history.pushState({}, '', '/login');
                        // Trigger navigation update if needed, but App.tsx listens to popstate only currently.
                        // We need a proper navigate function exposure or just use window.location.pathname trigger if App polls it or signals.
                        // App.tsx uses `pathname` signal. We should probably export `navigate` or just handle it here.
                        // For now, I'll rely on global `navigate` if I could export it, but I can't easily.
                        // I'll manually update history and dispatch a popstate event to trigger App.tsx listener.
                        window.dispatchEvent(new Event('popstate'));
                    }}>Log In</a>
                </div>
            </div>
        </div>
    );
}
