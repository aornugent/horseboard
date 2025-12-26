import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Display } from './views/Display';
import {
  HorsesTab,
  HorseDetail,
  BoardTab,
  FeedsTab,
  SettingsTab,
} from './views/Controller';
import { bootstrap, sseClient } from './services';
import { display } from './stores';
import './styles/theme.css';

// =============================================================================
// ROUTING STATE
// =============================================================================

const STORAGE_KEY = 'horseboard_display_id';

const pathname = signal(window.location.pathname);
const isInitialized = signal(false);
const connectionError = signal<string | null>(null);

// Listen for browser navigation
window.addEventListener('popstate', () => {
  pathname.value = window.location.pathname;
});

// Navigate helper
function navigate(path: string) {
  if (pathname.value !== path) {
    window.history.pushState({}, '', path);
    pathname.value = path;
  }
}

// =============================================================================
// CONTROLLER TABS
// =============================================================================

type ControllerTab = 'horses' | 'feeds' | 'board' | 'settings';

const activeTab = signal<ControllerTab>('horses');
const selectedHorseId = signal<string | null>(null);

function Controller() {
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
              <span>Board</span>
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

// =============================================================================
// TAB ICONS
// =============================================================================

interface TabIconProps {
  type: 'horses' | 'feeds' | 'board' | 'settings';
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
    settings: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    ),
  };

  return icons[type];
}

// =============================================================================
// LANDING PAGE
// =============================================================================

function Landing() {
  return (
    <div class="landing-view" data-testid="landing-view">
      <div class="landing-content">
        <h1 class="landing-title">HorseBoard</h1>
        <p class="landing-subtitle">Barn Feed Management System</p>

        <div class="landing-links">
          <a
            href="/controller"
            class="landing-link landing-link-primary"
            data-testid="landing-controller-link"
            onClick={(e) => {
              e.preventDefault();
              navigate('/controller');
            }}
          >
            <span class="landing-link-icon">📱</span>
            <span class="landing-link-text">Controller</span>
            <span class="landing-link-description">Manage feeds from your phone</span>
          </a>

          <a
            href="/display"
            class="landing-link"
            data-testid="landing-display-link"
            onClick={(e) => {
              e.preventDefault();
              navigate('/display');
            }}
          >
            <span class="landing-link-icon">📺</span>
            <span class="landing-link-text">Display</span>
            <span class="landing-link-description">Show feed board on TV</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PAIRING VIEW (when no display ID is stored)
// =============================================================================

const pairCode = signal('');
const isPairing = signal(false);
const pairError = signal<string | null>(null);

async function handlePair() {
  if (pairCode.value.length !== 6) return;

  isPairing.value = true;
  pairError.value = null;

  try {
    const response = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pairCode.value }),
    });

    const result = await response.json();

    if (result.success && result.displayId) {
      localStorage.setItem(STORAGE_KEY, result.displayId);
      await initializeApp(result.displayId);
    } else {
      pairError.value = result.error || 'Invalid pair code';
    }
  } catch {
    pairError.value = 'Connection failed';
  } finally {
    isPairing.value = false;
  }
}

async function handleCreateDisplay() {
  isPairing.value = true;
  pairError.value = null;

  try {
    const response = await fetch('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (result.id) {
      localStorage.setItem(STORAGE_KEY, result.id);
      await initializeApp(result.id);
    } else {
      pairError.value = 'Failed to create display';
    }
  } catch {
    pairError.value = 'Connection failed';
  } finally {
    isPairing.value = false;
  }
}

function PairingView() {
  return (
    <div class="pairing-view" data-testid="pairing-view">
      <div class="pairing-content">
        <h1 class="pairing-title">Connect to HorseBoard</h1>

        <div class="pairing-section">
          <h2 class="pairing-section-title">Join Existing Board</h2>
          <p class="pairing-description">
            Enter the 6-digit code shown on your TV display
          </p>
          <input
            type="text"
            class="pairing-input"
            data-testid="pair-code-input"
            placeholder="000000"
            maxLength={6}
            value={pairCode.value}
            onInput={(e) => {
              pairCode.value = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
            }}
          />
          <button
            class="pairing-btn pairing-btn-primary"
            data-testid="pair-btn"
            disabled={pairCode.value.length !== 6 || isPairing.value}
            onClick={handlePair}
          >
            {isPairing.value ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        <div class="pairing-divider">or</div>

        <div class="pairing-section">
          <h2 class="pairing-section-title">Create New Board</h2>
          <p class="pairing-description">
            Start fresh with a new feed board
          </p>
          <button
            class="pairing-btn"
            data-testid="create-display-btn"
            disabled={isPairing.value}
            onClick={handleCreateDisplay}
          >
            {isPairing.value ? 'Creating...' : 'Create New Board'}
          </button>
        </div>

        {pairError.value && (
          <div class="pairing-error" data-testid="pair-error">
            {pairError.value}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// APP INITIALIZATION
// =============================================================================

async function initializeApp(displayId: string): Promise<boolean> {
  try {
    const success = await bootstrap(displayId);
    if (!success) {
      connectionError.value = 'Failed to load data';
      return false;
    }

    await sseClient.connect(displayId);
    isInitialized.value = true;
    connectionError.value = null;
    return true;
  } catch {
    connectionError.value = 'Connection failed';
    return false;
  }
}

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

export function App() {
  // Initialize on mount
  useEffect(() => {
    const storedDisplayId = localStorage.getItem(STORAGE_KEY);

    if (storedDisplayId) {
      initializeApp(storedDisplayId);
    } else {
      // No display ID - redirect to controller for pairing if not on landing
      isInitialized.value = false;
    }

    // Cleanup SSE on unmount
    return () => {
      sseClient.disconnect();
    };
  }, []);

  // Handle redirect for root path
  useEffect(() => {
    if (pathname.value === '/') {
      // Show landing page
    }
  }, []);

  const path = pathname.value;

  // Show landing page at root
  if (path === '/') {
    return <Landing />;
  }

  // Check if we need to pair first (for controller views)
  const needsPairing = !display.value && !isInitialized.value;
  const storedDisplayId = localStorage.getItem(STORAGE_KEY);

  if ((path === '/controller' || path === '/board') && needsPairing && !storedDisplayId) {
    return <PairingView />;
  }

  // Show connection error if any
  if (connectionError.value && storedDisplayId) {
    return (
      <div class="error-view" data-testid="error-view">
        <div class="error-content">
          <h1>Connection Error</h1>
          <p>{connectionError.value}</p>
          <button
            class="error-retry-btn"
            onClick={() => initializeApp(storedDisplayId)}
          >
            Retry
          </button>
          <button
            class="error-reset-btn"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              connectionError.value = null;
              window.location.reload();
            }}
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  // Route to appropriate view
  switch (path) {
    case '/display':
      return <Display />;

    case '/controller':
      return <Controller />;

    case '/board':
      return <BoardTab />;

    default:
      // 404 - redirect to landing
      return <Landing />;
  }
}
