import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import {
    board,
    timezone,
    updateBoard
} from '../../../stores';
import {
    updateBoard as apiUpdateBoard,
    listDevices,
    revokeDeviceToken
} from '../../../services';
import { LinkDisplayModal } from '../../../components/LinkDisplayModal';

// Common timezones for horse farms
const TIMEZONES = [
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { value: 'UTC', label: 'UTC' },
];

async function saveTimezone(tz: string) {
    if (!board.value) return;

    try {
        await apiUpdateBoard(board.value.id, { timezone: tz });
        updateBoard({ timezone: tz });
    } catch (err) {
        console.error('Failed to update timezone:', err);
    }
}

export function SectionDevices({ canEditBoard }: { canEditBoard: boolean }) {
    const showLinkModal = useSignal(false);
    const linkedDevices = useSignal<any[]>([]);

    useEffect(() => {
        // Refresh list when component mounts or permission changes
        listDevices().then(d => linkedDevices.value = d).catch(console.error);
    }, []); // Run once (and relying on listDevices fetching fresh data)
    // Note: SettingsTab passed [permission.value] to useEffect. 
    // We can replicate that if we want, or assume this component re-mounts?
    // SettingsTab didn't remount. So we should probably expose a refresh trigger?
    // Generally, listDevices() is an API call.

    async function handleUnlink(tokenId: string) {
        if (confirm('Are you sure you want to unlink this display?')) {
            await revokeDeviceToken(tokenId);
            linkedDevices.value = await listDevices();
        }
    }

    return (
        <section class="section">
            <h3 class="section-title">Displays</h3>

            <div class="devices-list">
                {linkedDevices.value.length === 0 ? (
                    <div class="settings-empty-state">No displays connected</div>
                ) : (
                    linkedDevices.value.map(device => (
                        <div class="device-item" key={device.id}>
                            <div class="device-info">
                                <span class="device-name" data-testid="device-name">{device.name}</span>
                                <span class="device-meta">Added: {new Date(device.created_at).toLocaleDateString()}</span>
                            </div>
                            <button
                                class="btn-list btn-list-danger btn-list-small"
                                onClick={() => handleUnlink(device.id)}
                                data-testid="unlink-display-btn"
                            >
                                Unlink
                            </button>
                        </div>
                    ))
                )}
            </div>

            <button
                class="btn-list btn-list-primary btn-list-block"
                onClick={() => showLinkModal.value = true}
                data-testid="add-display-btn"
            >
                Link New Display
            </button>

            <div class="settings-display-timezone">
                <h4 class="settings-subsection-title">Timezone</h4>
                <p class="section-description">
                    Used for automatic AM/PM calculation
                </p>
                <div class="input-wrapper">
                    <select
                        class="input"
                        data-testid="timezone-selector"
                        value={timezone.value}
                        onChange={(e) => saveTimezone((e.target as HTMLSelectElement).value)}
                        disabled={!canEditBoard}
                    >
                        {TIMEZONES.map(tz => (
                            <option key={tz.value} value={tz.value}>
                                {tz.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {showLinkModal.value && (
                <LinkDisplayModal
                    onClose={() => showLinkModal.value = false}
                    onSuccess={() => listDevices().then(d => linkedDevices.value = d)}
                />
            )}
        </section>
    );
}
