import { useEffect } from 'preact/hooks';
import { Router } from './Router';
import { pathname } from './router';
import { initializeApp, isInitialized, connectionError } from './services/lifecycle';
import { STORAGE_KEY } from './constants';

import { loadControllerToken, sseClient } from './services';
import { board, initAuth, effective_time_mode } from './stores';


export function App() {
  useEffect(() => {
    initAuth();
    loadControllerToken();
    const storedBoardId = localStorage.getItem(STORAGE_KEY);
    // Also check for stored token
    // If token exists but no board ID, we need to resolve it (missing logic)
    // If token exists AND board ID exists, the request interceptor handles it.

    if (storedBoardId) {
      initializeApp(storedBoardId);
    } else {
      // No board ID - redirect to controller for pairing if not on landing
      isInitialized.value = false;
    }

    // Cleanup SSE on unmount
    return () => {
      sseClient.disconnect();
    };
  }, []);

  // Sync theme to body
  useEffect(() => {
    // Controller always uses AM (light) theme
    if (pathname.value.startsWith('/controller')) {
      document.body.setAttribute('data-theme', 'am');
      return;
    }

    const mode = board.value?.time_mode === 'AUTO' ? effective_time_mode.value : (board.value?.time_mode || 'AM');
    document.body.setAttribute('data-theme', mode.toLowerCase());
  }, [board.value, effective_time_mode.value, pathname.value]);



  const storedBoardId = localStorage.getItem(STORAGE_KEY);

  if (connectionError.value && storedBoardId) {
    return (
      <div class="error-view" data-testid="error-view">
        <div class="error-content">
          <h1>Connection Error</h1>
          <p>{connectionError.value}</p>
          <button
            class="error-retry-btn"
            onClick={() => initializeApp(storedBoardId)}
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

  return <Router />;
}
