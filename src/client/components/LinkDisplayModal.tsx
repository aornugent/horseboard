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
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal-content">
        <h2>Link Display</h2>
        <p>Enter the code shown on the TV display.</p>

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <input
              type="text"
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

          {error.value && <div class="error-message">{error.value}</div>}

          <div class="modal-actions">
            <button type="button" onClick={onClose} disabled={isLoading.value}>
              Cancel
            </button>
            <button
              type="submit"
              class="primary-btn"
              disabled={isLoading.value || code.value.length < 6}
              data-testid="provisioning-submit"
            >
              {isLoading.value ? 'Linking...' : 'Link Display'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: var(--bg-primary);
          padding: 24px;
          border-radius: 12px;
          width: 90%;
          max-width: 400px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .form-group {
          margin: 20px 0;
        }
        input {
          width: 100%;
          font-size: 24px;
          text-align: center;
          letter-spacing: 4px;
          padding: 12px;
          text-transform: uppercase;
          border: 2px solid var(--border);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
        .error-message {
          color: var(--danger);
          margin-bottom: 20px;
          text-align: center;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        button {
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
        .primary-btn {
          background: var(--primary);
          color: white;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
