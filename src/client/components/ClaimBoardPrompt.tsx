import { signal } from "@preact/signals";
import { authClient, initAuth } from "../services/auth";
import { claimBoard } from "../services";
import { ownership, setOwnership, board } from "../stores";
import './ClaimBoardPrompt.css';

export function ClaimBoardPrompt() {
    const name = signal("");
    const email = signal("");
    const password = signal("");
    const isSubmitting = signal(false);
    const error = signal<string | null>(null);

    // Don't show if already claimed
    if (ownership.value.is_claimed) return null;

    async function handleClaim(e: Event) {
        e.preventDefault();
        isSubmitting.value = true;
        error.value = null;

        try {
            // 1. Sign up
            const { error: authError } = await authClient.signUp.email({
                email: email.value,
                password: password.value,
                name: name.value
            });

            if (authError) {
                throw new Error(authError.message || 'Signup failed');
            }

            // 2. Claim board
            if (board.value?.id) {
                await claimBoard(board.value.id);

                // Update ownership
                setOwnership({
                    is_claimed: true,
                    is_owner: true,
                    permission: 'admin'
                });

                // Refresh auth state
                await initAuth();
            }

        } catch (e: any) {
            error.value = e.message || 'An error occurred';
        } finally {
            isSubmitting.value = false;
        }
    }

    return (
        <div class="claim-prompt">
            <h2>Claim this Board</h2>
            <p>This board is unclaimed. Sign up to become the owner.</p>
            <form onSubmit={handleClaim}>
                <input
                    type="text"
                    placeholder="Name"
                    value={name.value}
                    onInput={(e) => name.value = (e.currentTarget as HTMLInputElement).value}
                    required
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email.value}
                    onInput={(e) => email.value = (e.currentTarget as HTMLInputElement).value}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password.value}
                    onInput={(e) => password.value = (e.currentTarget as HTMLInputElement).value}
                    required
                />
                <button type="submit" disabled={isSubmitting.value}>
                    {isSubmitting.value ? 'Claiming...' : 'Sign Up & Claim'}
                </button>
                {error.value && <div class="error">{error.value}</div>}
            </form>
        </div>
    );
}
