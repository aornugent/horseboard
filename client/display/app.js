/**
 * TV Display Application
 *
 * Handles:
 * - Creating/restoring display sessions
 * - Showing pairing code
 * - SSE connection for real-time updates
 * - Feed grid rendering with domain model
 */

const STORAGE_KEY = 'horseboard_display_id';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

// Horses per page based on zoom level
const HORSES_PER_PAGE = {
  1: 10,
  2: 7,
  3: 5
};

// Fraction display mapping
const FRACTIONS = {
  0.25: '¼',
  0.33: '⅓',
  0.5: '½',
  0.66: '⅔',
  0.75: '¾'
};

// State
let displayId = null;
let eventSource = null;
let reconnectAttempts = 0;

// DOM Elements
const screens = {
  pairing: document.getElementById('pairing-screen'),
  loading: document.getElementById('loading-screen'),
  empty: document.getElementById('empty-screen'),
  table: document.getElementById('table-screen')
};

const elements = {
  pairCode: document.getElementById('pair-code'),
  controllerUrl: document.getElementById('controller-url'),
  feedGrid: document.getElementById('feed-grid'),
  pagination: document.getElementById('pagination'),
  pageInfo: document.getElementById('page-info'),
  timeMode: document.getElementById('time-mode'),
  errorOverlay: document.getElementById('error-overlay')
};

/**
 * Show a specific screen, hide all others
 */
function showScreen(screenName) {
  Object.entries(screens).forEach(([name, el]) => {
    if (name === screenName) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

/**
 * Show/hide error overlay
 */
function showError(show) {
  if (show) {
    elements.errorOverlay.classList.remove('hidden');
  } else {
    elements.errorOverlay.classList.add('hidden');
  }
}

/**
 * Create a new display session
 */
async function createDisplay() {
  const response = await fetch('/api/displays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to create display');
  }

  const data = await response.json();
  return data;
}

/**
 * Verify a display still exists
 */
async function verifyDisplay(id) {
  const response = await fetch(`/api/displays/${id}`);
  return response.ok;
}

/**
 * Initialize or restore display session
 */
async function initDisplay() {
  showScreen('loading');

  // Check for existing display ID
  const storedId = localStorage.getItem(STORAGE_KEY);

  if (storedId) {
    // Verify it still exists
    const exists = await verifyDisplay(storedId);
    if (exists) {
      displayId = storedId;
      connectSSE();
      return;
    }
    // Clear invalid ID
    localStorage.removeItem(STORAGE_KEY);
  }

  // Create new display
  try {
    const display = await createDisplay();
    displayId = display.id;
    localStorage.setItem(STORAGE_KEY, displayId);

    // Show pairing screen with code
    elements.pairCode.textContent = display.pairCode;
    elements.controllerUrl.textContent = `${window.location.origin}/controller`;
    showScreen('pairing');

    // Connect to SSE for updates
    connectSSE();
  } catch (error) {
    console.error('Failed to initialize display:', error);
    showError(true);
  }
}

/**
 * Connect to Server-Sent Events endpoint
 */
function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`/api/displays/${displayId}/events`);

  eventSource.onopen = () => {
    console.log('SSE connected');
    reconnectAttempts = 0;
    showError(false);
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleUpdate(data);
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection error');
    eventSource.close();

    // Show error overlay if we were showing data
    if (!screens.pairing.classList.contains('hidden') === false) {
      showError(true);
    }

    // Attempt to reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Reconnecting in ${RECONNECT_DELAY_MS}ms (attempt ${reconnectAttempts})`);
      setTimeout(connectSSE, RECONNECT_DELAY_MS);
    }
  };
}

/**
 * Handle data update from SSE
 */
function handleUpdate(data) {
  const tableData = data.tableData;

  // No data yet - show empty state
  if (!tableData || !tableData.horses || tableData.horses.length === 0) {
    // Only show empty screen if we've been paired (have data at least once)
    // Otherwise stay on pairing screen
    if (screens.pairing.classList.contains('hidden')) {
      showScreen('empty');
    }
    return;
  }

  // Render feed grid
  renderFeedGrid(tableData);
  showScreen('table');
}

/**
 * Format a numeric value for display
 * Converts common fractions to symbols, shows unit for other decimals
 */
function formatValue(value, unit) {
  if (value === null || value === undefined || value === 0) {
    return '';
  }

  // Check for exact fraction matches
  if (FRACTIONS[value]) {
    return FRACTIONS[value];
  }

  // Check for whole + fraction (e.g., 1.5 → 1½)
  const whole = Math.floor(value);
  const decimal = Math.round((value - whole) * 100) / 100;

  if (whole > 0 && FRACTIONS[decimal]) {
    return `${whole}${FRACTIONS[decimal]}`;
  }

  // For other values, show with unit if not a whole number
  if (Number.isInteger(value)) {
    return String(value);
  }

  return `${value}`;
}

/**
 * Determine current time mode (AM/PM) based on settings
 */
function getActiveTimeMode(settings) {
  if (!settings) return 'am';

  const { timeMode, overrideUntil, timezone } = settings;

  // Check if override is still active
  if (timeMode !== 'AUTO' && overrideUntil) {
    if (Date.now() < overrideUntil) {
      return timeMode.toLowerCase();
    }
  }

  // Auto-detect based on timezone
  if (timeMode === 'AUTO') {
    const tz = timezone || 'UTC';
    const now = new Date();
    const hour = parseInt(now.toLocaleString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false
    }));

    // 04:00 - 11:59 = AM, 12:00 - 03:59 = PM
    return (hour >= 4 && hour < 12) ? 'am' : 'pm';
  }

  return timeMode.toLowerCase();
}

/**
 * Filter feeds to only those with at least one non-zero value
 */
function getActiveFeeds(feeds, horses, diet, timeMode) {
  return feeds.filter(feed => {
    return horses.some(horse => {
      const horseDiet = diet[horse.id];
      if (!horseDiet) return false;
      const feedDiet = horseDiet[feed.id];
      if (!feedDiet) return false;
      return feedDiet[timeMode] > 0;
    });
  });
}

/**
 * Render the feed grid to the DOM
 */
function renderFeedGrid(tableData) {
  const { settings, feeds, horses, diet } = tableData;

  // Get current time mode
  const timeMode = getActiveTimeMode(settings);

  // Update time indicator
  if (elements.timeMode) {
    elements.timeMode.textContent = timeMode.toUpperCase();
  }

  // Get pagination settings
  const zoomLevel = settings?.zoomLevel || 2;
  const currentPage = settings?.currentPage || 0;
  const horsesPerPage = HORSES_PER_PAGE[zoomLevel] || 7;

  // Calculate which horses to show
  const totalHorses = horses.length;
  const totalPages = Math.ceil(totalHorses / horsesPerPage);
  const startIdx = currentPage * horsesPerPage;
  const displayHorses = horses.slice(startIdx, startIdx + horsesPerPage);

  // Filter feeds to only active ones (with non-zero values)
  const activeFeeds = getActiveFeeds(feeds, displayHorses, diet, timeMode);

  // Sort feeds by rank
  activeFeeds.sort((a, b) => (a.rank || 999) - (b.rank || 999));

  // Build the grid
  const grid = elements.feedGrid;
  grid.innerHTML = '';

  // Set grid columns: 1 for feed name + 1 for each horse
  grid.style.gridTemplateColumns = `minmax(120px, 1fr) repeat(${displayHorses.length}, 1fr)`;

  // --- HEADER ROW: Feed label + horse names ---
  const feedHeader = document.createElement('div');
  feedHeader.className = 'grid-cell header feed-label';
  feedHeader.textContent = 'Feed';
  grid.appendChild(feedHeader);

  displayHorses.forEach(horse => {
    const cell = document.createElement('div');
    cell.className = 'grid-cell header horse-name';
    cell.textContent = horse.name;
    grid.appendChild(cell);
  });

  // --- FEED ROWS ---
  activeFeeds.forEach(feed => {
    // Feed name cell
    const nameCell = document.createElement('div');
    nameCell.className = 'grid-cell feed-name';
    nameCell.innerHTML = `<span class="name">${feed.name}</span><span class="unit">${feed.unit}</span>`;
    grid.appendChild(nameCell);

    // Diet values for each horse
    displayHorses.forEach(horse => {
      const valueCell = document.createElement('div');
      valueCell.className = 'grid-cell value';

      const horseDiet = diet[horse.id];
      const feedDiet = horseDiet?.[feed.id];
      const value = feedDiet?.[timeMode];

      valueCell.textContent = formatValue(value, feed.unit);

      // Add empty class for styling if no value
      if (!value) {
        valueCell.classList.add('empty');
      }

      grid.appendChild(valueCell);
    });
  });

  // --- NOTES ROW ---
  const hasNotes = displayHorses.some(h => h.note);
  if (hasNotes) {
    // Notes label
    const notesLabel = document.createElement('div');
    notesLabel.className = 'grid-cell footer notes-label';
    notesLabel.textContent = 'Notes';
    grid.appendChild(notesLabel);

    // Notes for each horse
    displayHorses.forEach(horse => {
      const noteCell = document.createElement('div');
      noteCell.className = 'grid-cell footer note';
      noteCell.textContent = horse.note || '';
      grid.appendChild(noteCell);
    });
  }

  // Update pagination display
  if (totalPages > 1) {
    elements.pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
    elements.pagination.classList.remove('hidden');
  } else {
    elements.pagination.classList.add('hidden');
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initDisplay);
