import { signal } from '@preact/signals';
import { navigate } from '../router';
import { pairWithCode } from '../services';
import { initializeApp } from '../services/lifecycle';
import { STORAGE_KEY } from '../constants';
import { boardId } from '../stores/token';

const pairCode = signal('');
const isConnecting = signal(false);
const connectError = signal<string | null>(null);

async function handleConnect() {
    isConnecting.value = true;
    connectError.value = null;

    try {
        if (pairCode.value.length !== 6) return;
        const result = await pairWithCode(pairCode.value);

        if (result.success && result.board_id) {
            localStorage.setItem(STORAGE_KEY, result.board_id);
            boardId.value = result.board_id;
            await initializeApp(result.board_id);
            navigate('/controller');
        } else {
            connectError.value = result.error || 'Invalid code';
        }
    } catch (err) {
        connectError.value = (err as Error).message || 'Connection failed';
    } finally {
        isConnecting.value = false;
    }
}

export function Landing() {
    return (
        <div class="landing-view" data-testid="landing-view">
            <div class="landing-card">
                <div class="landing-header">
                    <h1 class="landing-title">HorseBoard</h1>
                    <p class="landing-subtitle">Barn Feed Management System</p>
                </div>

                <div class="landing-primary">
                    <label class="landing-code-label">Enter 6-digit code</label>
                    <input
                        type="text"
                        class="landing-code-input"
                        data-testid="landing-code-input"
                        placeholder="000000"
                        maxLength={6}
                        value={pairCode.value}
                        onInput={(e) => {
                            pairCode.value = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
                            connectError.value = null;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && pairCode.value.length === 6) {
                                handleConnect();
                            }
                        }}
                    />
                    <button
                        class="landing-connect-btn"
                        data-testid="landing-connect-btn"
                        disabled={pairCode.value.length !== 6 || isConnecting.value}
                        onClick={handleConnect}
                    >
                        {isConnecting.value ? 'Connecting...' : 'Connect'}
                    </button>

                    {connectError.value && (
                        <div class="landing-error" data-testid="landing-error">
                            {connectError.value}
                        </div>
                    )}
                </div>

                <div class="landing-divider">
                    <span>or</span>
                </div>

                <div class="landing-secondary">
                    <a
                        href="/signup"
                        class="landing-link"
                        data-testid="landing-signup-link"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('/signup');
                        }}
                    >
                        I'm the owner / manager
                    </a>
                    <a
                        href="/login"
                        class="landing-link"
                        data-testid="landing-login-link"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('/login');
                        }}
                    >
                        Sign in
                    </a>
                </div>
            </div>
        </div>
    );
}
