import { setDisplay, setHorses, setFeeds, setDietEntries } from '../stores';
import type { Display, Horse, Feed, DietEntry } from '@shared/resources';

interface BootstrapResponse {
  success: boolean;
  data?: {
    display: Display;
    horses: Horse[];
    feeds: Feed[];
    dietEntries: DietEntry[];
  };
  error?: string;
}

interface PairResponse {
  success: boolean;
  displayId?: string;
  error?: string;
}

/**
 * Bootstrap the application with initial data
 */
export async function bootstrap(displayId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/bootstrap/${displayId}`);
    const result: BootstrapResponse = await response.json();

    if (result.success && result.data) {
      setDisplay(result.data.display);
      setHorses(result.data.horses);
      setFeeds(result.data.feeds);
      setDietEntries(result.data.dietEntries);
      return true;
    }

    console.error('Bootstrap failed:', result.error);
    return false;
  } catch (err) {
    console.error('Bootstrap error:', err);
    return false;
  }
}

/**
 * Pair with a display using a 6-digit code
 */
export async function pairWithCode(code: string): Promise<{ success: boolean; displayId?: string; error?: string }> {
  try {
    const response = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const result: PairResponse = await response.json();

    if (result.success && result.displayId) {
      // Bootstrap the display data
      await bootstrap(result.displayId);
    }

    return result;
  } catch (err) {
    console.error('Pair error:', err);
    return { success: false, error: 'Connection failed' };
  }
}

/**
 * Create a new display
 */
export async function createDisplay(): Promise<{ success: boolean; display?: Display; error?: string }> {
  try {
    const response = await fetch('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const display: Display = await response.json();

    if (display.id) {
      setDisplay(display);
      return { success: true, display };
    }

    return { success: false, error: 'Failed to create display' };
  } catch (err) {
    console.error('Create display error:', err);
    return { success: false, error: 'Connection failed' };
  }
}

export default { bootstrap, pairWithCode, createDisplay };
