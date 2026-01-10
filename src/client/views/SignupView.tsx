import { signal } from '@preact/signals';
import { authClient } from '../stores';
import { navigate } from '../router';
import { STORAGE_KEY } from '../services/lifecycle';


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
            error.value = 'An unexpected error occurred';
            console.error(err);
        } finally {
            isLoading.value = false;
        }
    };

    return (
        <div class="form-view" data-testid="signup-view">
            <div class="form-card">
                <div class="form-header">
                    <h1 class="form-title">Create Account</h1>
                    <p class="form-subtitle">Get started with HorseBoard</p>
                </div>

                <form onSubmit={handleSignup}>
                    <div class="form-group">
                        <label class="form-label" for="name">Full Name</label>
                        <input
                            id="name"
                            type="text"
                            class="input"
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
                            minLength={8}
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
                        {isLoading.value ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <div class="form-footer">
                    Already have an account?
                    <a href="/login" class="text-link" onClick={(e) => {
                        e.preventDefault();
                        navigate('/login');
                    }}>Log In</a>
                </div>
            </div>
        </div>
    );
}
