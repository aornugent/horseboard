import { signal } from '@preact/signals';
import { authClient } from '../stores';
import { navigate } from '../router';
import { STORAGE_KEY } from '../services/lifecycle';


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
                try {
                    const { listUserBoards, createBoard } = await import('../services');
                    const { setPermission } = await import('../stores');
                    const { authState } = await import('../stores');
                    if (data) {
                        authState.value = {
                            user: data.user,
                            session: null,
                            isLoading: false
                        };
                    }
                    const boards = await listUserBoards();
                    let boardId;
                    if (boards.length === 0) {
                        const newBoard = await createBoard();
                        boardId = newBoard.id;
                        // Owner has admin permission on their board
                        setPermission('admin');
                    } else {
                        boardId = boards[0].id;
                        // Assume admin for their own board (server validates)
                        setPermission('admin');
                    }
                    localStorage.setItem(STORAGE_KEY, boardId);
                } catch (e) {
                    console.error('Auto-setup failed:', e);
                }
                window.location.href = '/controller';
            }
        } catch (err) {
            error.value = (err as any)?.message || 'An unexpected error occurred';
            console.error(err);
        } finally {
            isLoading.value = false;
        }
    };

    return (
        <div class="form-view" data-testid="login-view">
            <div class="form-card">
                <div class="form-header">
                    <h1 class="form-title">Welcome Back</h1>
                    <p class="form-subtitle">Sign in to manage your stable</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div class="form-group">
                        <label class="form-label" for="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            class="input"
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
                            class="input"
                            data-testid="password-input"
                            value={password.value}
                            onInput={(e) => (password.value = (e.target as HTMLInputElement).value)}
                            placeholder="••••••••"
                            required
                            disabled={isLoading.value}
                        />
                    </div>

                    {error.value && (
                        <div class="form-error">
                            {error.value}
                        </div>
                    )}

                    <button
                        type="submit"
                        class="btn-block"
                        data-testid="submit-btn"
                        disabled={isLoading.value}
                    >
                        {isLoading.value ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div class="form-footer">
                    Don't have an account?
                    <a href="/signup" class="text-link" onClick={(e) => {
                        e.preventDefault();
                        navigate('/signup');
                    }}>Sign Up</a>
                </div>
            </div>
        </div>
    );
}
