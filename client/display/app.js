/**
 * TV Display Application
 *
 * Handles:
 * - Creating/restoring display sessions
 * - Showing pairing code
 * - SSE connection for real-time updates
 * - Table rendering
 */

const STORAGE_KEY = 'horseboard_display_id';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

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
  tableHead: document.getElementById('table-head'),
  tableBody: document.getElementById('table-body'),
  pagination: document.getElementById('pagination'),
  pageInfo: document.getElementById('page-info'),
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
  if (!tableData || !tableData.headers || tableData.headers.length === 0) {
    // Only show empty screen if we've been paired (have data at least once)
    // Otherwise stay on pairing screen
    if (screens.pairing.classList.contains('hidden')) {
      showScreen('empty');
    }
    return;
  }

  // Render table
  renderTable(tableData);
  showScreen('table');
}

/**
 * Render table data to the DOM
 */
function renderTable(tableData) {
  const { headers, rows, displaySettings } = tableData;

  // Render headers
  elements.tableHead.innerHTML = '';
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  elements.tableHead.appendChild(headerRow);

  // Determine which rows to display
  let displayRows = rows || [];
  let startRow = 0;
  let totalRows = displayRows.length;

  if (displaySettings && typeof displaySettings.startRow === 'number') {
    startRow = displaySettings.startRow;
    const rowCount = displaySettings.rowCount || displayRows.length;
    displayRows = displayRows.slice(startRow, startRow + rowCount);
  }

  // Render rows
  elements.tableBody.innerHTML = '';
  displayRows.forEach(row => {
    const tr = document.createElement('tr');
    // Ensure row has same number of cells as headers
    for (let i = 0; i < headers.length; i++) {
      const td = document.createElement('td');
      td.textContent = row[i] !== undefined ? row[i] : '';
      tr.appendChild(td);
    }
    elements.tableBody.appendChild(tr);
  });

  // Show pagination if applicable
  if (displaySettings && displaySettings.rowCount && totalRows > displaySettings.rowCount) {
    const currentPage = Math.floor(startRow / displaySettings.rowCount) + 1;
    const totalPages = Math.ceil(totalRows / displaySettings.rowCount);
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    elements.pagination.classList.remove('hidden');
  } else {
    elements.pagination.classList.add('hidden');
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initDisplay);
