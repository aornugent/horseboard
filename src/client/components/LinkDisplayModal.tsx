import { signal } from '@preact/signals';
import { linkDevice } from '../services';
import { board } from '../stores';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const code = signal('');
const error = signal<string | null>(null);
const isLoading = signal(false);

export function LinkDisplayModal({ onClose, onSuccess }: Props) {
  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!board.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      await linkDevice(code.value.toUpperCase(), board.value.id);
      code.value = '';
      onSuccess();
      onClose();
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      isLoading.value = false;
    }
  }

  return (
    <div class="link-display-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="link-display-modal-content" data-testid="link-display-modal">
        <h2 class="link-display-modal-title">Link Display</h2>
        <p class="link-display-modal-description">Enter the code shown on the TV display.</p>

        <form onSubmit={handleSubmit}>
          <div class="link-display-form-group">
            <input
              type="text"
              class="link-display-input"
              placeholder="ABCDEF"
              maxLength={6}
              value={code.value}
              onInput={(e) => {
                code.value = (e.target as HTMLInputElement).value;
                error.value = null;
              }}
              disabled={isLoading.value}
              autoFocus
              data-testid="provisioning-input"
            />
          </div>

          {error.value && <div class="link-display-error" data-testid="provisioning-error">{error.value}</div>}

          <div class="link-display-actions">
            <button
              type="button"
              class="link-display-btn"
              onClick={onClose}
              disabled={isLoading.value}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="link-display-btn link-display-btn-primary"
              disabled={isLoading.value || code.value.length < 6}
              data-testid="provisioning-submit"
            >
              {isLoading.value ? 'Linking...' : 'Link Display'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .link-display-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .link-display-modal-content {
          background: var(--color-bg-primary);
          padding: 1.5rem;
          border-radius: 12px;
          width: 90%;
          max-width: 400px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }
        .link-display-modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0 0 0.5rem;
        }
        .link-display-modal-description {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 1.5rem;
        }
        .link-display-form-group {
          margin: 0 0 1rem;
        }
        .link-display-input {
          width: 100%;
          font-size: 1.5rem;
          text-align: center;
          letter-spacing: 0.2em;
          padding: 1rem;
          text-transform: uppercase;
          border: 2px solid transparent;
          border-radius: 12px;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-family: monospace;
          min-height: 48px;
        }
        .link-display-input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
        .link-display-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .link-display-error {
          color: #ef4444;
          font-size: 0.875rem;
          text-align: center;
          margin-bottom: 1rem;
        }
        .link-display-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        .link-display-btn {
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          min-height: 48px;
          transition: all 0.15s ease;
        }
        .link-display-btn:hover:not(:disabled) {
          border-color: var(--color-text-secondary);
        }
        .link-display-btn-primary {
          background: var(--color-primary);
          color: white;
        }
        .link-display-btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        .link-display-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
