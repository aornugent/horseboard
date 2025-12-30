import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { pollProvisioning, setControllerToken, resolveToken } from '../services';

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

const provisioningCode = signal(generateCode());

export function ProvisioningView({ onProvisioned }: { onProvisioned: (boardId: string) => void }) {
    useEffect(() => {
        let mounted = true;
        let timeoutId: any;

        async function checkStatus() {
            if (!mounted) return;

            const result = await pollProvisioning(provisioningCode.value);

            if (result.token) {
                // Success!
                setControllerToken(result.token);
                // Resolve token to get board ID
                try {
                    const { board_id } = await resolveToken();
                    if (board_id && mounted) {
                        onProvisioned(board_id);
                        return; // Stop polling
                    }
                } catch (e) {
                    console.error("Failed to resolve token", e);
                }
            }

            if (mounted) {
                timeoutId = setTimeout(checkStatus, 3000);
            }
        }

        checkStatus();

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <div class="provisioning-view">
            <div class="provisioning-content">
                <h1>Connect Display</h1>
                <p>Enter this code in your Controller Settings</p>

                <div class="provisioning-code">
                    {provisioningCode.value.split('').map(char => (
                        <span class="code-char">{char}</span>
                    ))}
                </div>

                <div class="provisioning-instructions">
                    <p>1. Open HorseBoard on your phone</p>
                    <p>2. Go to Settings &gt; Displays</p>
                    <p>3. Tap "Add Display" and enter code</p>
                </div>
            </div>

            <style>{`
        .provisioning-view {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          color: var(--text-primary);
          text-align: center;
        }
        .provisioning-content {
          max-width: 500px;
          padding: 40px;
        }
        .provisioning-code {
          font-size: 64px;
          font-weight: bold;
          letter-spacing: 10px;
          margin: 40px 0;
          font-family: monospace;
          color: var(--primary);
        }
        .code-char {
            display: inline-block;
            background: var(--bg-secondary);
            padding: 10px 20px;
            margin: 0 5px;
            border-radius: 8px;
            border: 2px solid var(--border);
        }
        .provisioning-instructions {
            opacity: 0.8;
            line-height: 1.6;
        }
      `}</style>
        </div>
    );
}
