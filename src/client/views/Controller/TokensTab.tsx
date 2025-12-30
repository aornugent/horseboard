import { useState, useEffect } from 'preact/hooks';
import { board } from '../../stores';
import {
    listControllerTokens,
    createControllerToken,
    revokeControllerToken,
    type ControllerToken
} from '../../services';
import { Modal } from '../../components/Modal';
import './TokensTab.css';

export function TokensTab() {
    const [tokens, setTokens] = useState<ControllerToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Create form state
    const [tokenName, setTokenName] = useState('');
    const [tokenPermission, setTokenPermission] = useState<'view' | 'edit'>('view');
    const [creating, setCreating] = useState(false);

    // New token display state
    const [newToken, setNewToken] = useState<string | null>(null);

    useEffect(() => {
        loadTokens();
    }, [board.value?.id]);

    async function loadTokens() {
        if (!board.value) return;
        try {
            setLoading(true);
            const data = await listControllerTokens(board.value.id);
            setTokens(data);
        } catch (err) {
            console.error('Failed to load tokens:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateToken(e: Event) {
        e.preventDefault();
        if (!board.value || !tokenName) return;

        try {
            setCreating(true);
            // Default to 1 year expiry for now, or make it optional in UI later
            // const oneYear = new Date();
            // oneYear.setFullYear(oneYear.getFullYear() + 1);

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

    async function handleRevoke(id: string) {
        if (!confirm('Are you sure you want to revoke this token? It will stop working immediately.')) {
            return;
        }

        try {
            await revokeControllerToken(id);
            await loadTokens();
        } catch (err) {
            console.error('Failed to revoke token:', err);
            alert('Failed to revoke token');
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

    if (loading && tokens.length === 0) {
        return (
            <div class="tokens-tab">
                <div class="empty-state">Loading tokens...</div>
            </div>
        );
    }

    return (
        <div class="tokens-tab">
            <div class="tokens-header">
                <h2 class="tokens-title">Tokens</h2>
                <button
                    class="create-token-btn"
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    Create Token
                </button>
            </div>

            {tokens.length === 0 ? (
                <div class="empty-state">
                    <p>No controller tokens created yet.</p>
                    <p>Create a token to allow other devices to access this board.</p>
                </div>
            ) : (
                <div class="tokens-list">
                    {tokens.map(token => (
                        <div class="token-item" key={token.id}>
                            <div class="token-info">
                                <span class="token-name">{token.name}</span>
                                <div class="token-details">
                                    <span class={`token-badge ${token.permission}`}>
                                        {token.permission}
                                    </span>
                                    <span>Created: {formatDate(token.created_at)}</span>
                                    <span>Used: {formatDate(token.last_used_at)}</span>
                                </div>
                            </div>
                            <div class="token-actions">
                                <button
                                    class="revoke-btn"
                                    onClick={() => handleRevoke(token.id)}
                                >
                                    Revoke
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={closeCreateModal}
                title={newToken ? "Token Created" : "Create Controller Token"}
            >
                {newToken ? (
                    <div class="new-token-display">
                        <p>This is the only time you will see this token.</p>
                        <div class="token-value">{newToken}</div>
                        <button class="copy-btn" onClick={copyToken}>
                            Copy to Clipboard
                        </button>
                        <p class="warning-text">
                            Store this token safely. It grants access to your board.
                        </p>
                        <div class="form-actions">
                            <button class="btn-primary" onClick={closeCreateModal}>
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <form class="token-form" onSubmit={handleCreateToken}>
                        <div class="form-group">
                            <label class="form-label">Token Name</label>
                            <input
                                type="text"
                                class="form-input"
                                placeholder="e.g. Barn iPad, Staff Phone"
                                value={tokenName}
                                onInput={(e) => setTokenName((e.target as HTMLInputElement).value)}
                                required
                            />
                        </div>

                        <div class="form-group">
                            <label class="form-label">Permission Level</label>
                            <select
                                class="form-select"
                                value={tokenPermission}
                                onChange={(e) => setTokenPermission((e.target as HTMLSelectElement).value as 'view' | 'edit')}
                            >
                                <option value="view">View Only (Read-only)</option>
                                <option value="edit">Edit (Full Control)</option>
                            </select>
                        </div>

                        <div class="form-actions">
                            <button
                                type="button"
                                class="btn-secondary"
                                onClick={closeCreateModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                class="btn-primary"
                                disabled={creating || !tokenName}
                            >
                                {creating ? 'Creating...' : 'Create Token'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
