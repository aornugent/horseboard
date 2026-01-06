import { signal } from '@preact/signals';
import {
    HorsesTab,
    HorseDetail,
    BoardTab,
    FeedsTab,
    SettingsTab,
    ReferenceTab,
} from './Controller';

type ControllerTab = 'horses' | 'feeds' | 'board' | 'reference' | 'settings';

const activeTab = signal<ControllerTab>('horses');
const selectedHorseId = signal<string | null>(null);

export function ControllerView() {
    return (
        <div class="controller-view" data-testid="controller-view">
            {selectedHorseId.value ? (
                <HorseDetail
                    horseId={selectedHorseId.value}
                    onBack={() => (selectedHorseId.value = null)}
                />
            ) : (
                <>
                    <div class="controller-content">

                        {activeTab.value === 'horses' && (
                            <HorsesTab
                                onHorseSelect={(id) => (selectedHorseId.value = id)}
                            />
                        )}
                        {activeTab.value === 'feeds' && <FeedsTab />}
                        {activeTab.value === 'board' && <BoardTab />}
                        {activeTab.value === 'reference' && <ReferenceTab />}
                        {activeTab.value === 'settings' && <SettingsTab />}
                    </div>

                    <nav class="controller-tabs" data-testid="controller-tabs">
                        <button
                            class={`tab-btn ${activeTab.value === 'horses' ? 'active' : ''}`}
                            data-testid="tab-horses"
                            onClick={() => (activeTab.value = 'horses')}
                        >
                            <TabIcon type="horses" />
                            <span>Horses</span>
                        </button>
                        <button
                            class={`tab-btn ${activeTab.value === 'feeds' ? 'active' : ''}`}
                            data-testid="tab-feeds"
                            onClick={() => (activeTab.value = 'feeds')}
                        >
                            <TabIcon type="feeds" />
                            <span>Feeds</span>
                        </button>
                        <button
                            class={`tab-btn ${activeTab.value === 'board' ? 'active' : ''}`}
                            data-testid="tab-board"
                            onClick={() => (activeTab.value = 'board')}
                        >
                            <TabIcon type="board" />
                            <span>Preview</span>
                        </button>
                        <button
                            class={`tab-btn ${activeTab.value === 'reference' ? 'active' : ''}`}
                            data-testid="tab-reference"
                            onClick={() => (activeTab.value = 'reference')}
                        >
                            <TabIcon type="reference" />
                            <span>Ref</span>
                        </button>
                        <button
                            class={`tab-btn ${activeTab.value === 'settings' ? 'active' : ''}`}
                            data-testid="tab-settings"
                            onClick={() => (activeTab.value = 'settings')}
                        >
                            <TabIcon type="settings" />
                            <span>Settings</span>
                        </button>
                    </nav>
                </>
            )}
        </div>
    );
}

interface TabIconProps {
    type: 'horses' | 'feeds' | 'board' | 'reference' | 'settings';
}

function TabIcon({ type }: TabIconProps) {
    const icons = {
        horses: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6l3 3v12h4V10l4-4 4 4v11h4V9l3-3" />
            </svg>
        ),
        feeds: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21V3h6v18" />
                <path d="M4 21V9h5" />
                <path d="M15 21V9h5v12" />
            </svg>
        ),
        board: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
            </svg>
        ),
        reference: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 6h13" />
                <path d="M8 12h13" />
                <path d="M8 18h13" />
                <path d="M3 6h.01" />
                <path d="M3 12h.01" />
                <path d="M3 18h.01" />
            </svg>
        ),
        settings: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
            </svg>
        ),
    };

    return icons[type];
}

