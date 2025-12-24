/**
 * Mobile Controller Application
 *
 * Handles:
 * - Pairing with TV display via 6-digit code
 * - Tab navigation (Board, Horses, Feeds, Reports)
 * - Domain-specific feed management
 */

const STORAGE_KEY = 'horseboard_controller_display_id';
const TAB_STORAGE_KEY = 'horseboard_controller_tab';
const DEBOUNCE_MS = 500;

// Zoom level to horses per page mapping
const ZOOM_HORSES = { 1: 10, 2: 7, 3: 5 };

// State
let displayId = null;
let tableData = {
  settings: {
    timezone: 'Australia/Sydney',
    timeMode: 'AUTO',
    overrideUntil: null,
    zoomLevel: 2,
    currentPage: 0
  },
  feeds: [],
  horses: [],
  diet: {}
};
let hasUnsavedChanges = false;
let saveTimeout = null;
let currentTab = 'board';

// Modal state
let editingQuantity = { horseId: null, feedId: null, period: null };
let editingNote = { horseId: null };
let editingHorse = { id: null, isNew: false };
let editingFeed = { id: null, isNew: false };
let deleteTarget = { type: null, id: null };

// DOM Elements
const screens = {
  pairing: document.getElementById('pairing-screen'),
  loading: document.getElementById('loading-screen'),
  editor: document.getElementById('editor-screen')
};

// ===================
// Screen Management
// ===================

function showScreen(screenName) {
  Object.entries(screens).forEach(([name, el]) => {
    if (name === screenName) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// ===================
// Toast Notifications
// ===================

let toastTimeout = null;

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toast.textContent = message;
  toast.className = 'toast';
  if (type !== 'info') {
    toast.classList.add(type);
  }

  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ===================
// Tab Navigation
// ===================

function switchTab(tabName) {
  currentTab = tabName;
  sessionStorage.setItem(TAB_STORAGE_KEY, tabName);

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  // Render current tab content
  renderCurrentTab();
}

function renderCurrentTab() {
  switch (currentTab) {
    case 'board':
      renderBoard();
      break;
    case 'horses':
      renderHorsesList();
      break;
    case 'feeds':
      renderFeedsList();
      break;
    case 'reports':
      renderReports();
      break;
  }
}

// ===================
// Pairing Logic
// ===================

function setupPairingInputs() {
  const digits = document.querySelectorAll('.code-digit');

  digits.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      e.target.value = value.slice(-1);

      if (value && index < 5) {
        digits[index + 1].focus();
      }

      e.target.classList.toggle('filled', value.length > 0);
      updateConnectButton();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        digits[index - 1].focus();
        digits[index - 1].value = '';
        digits[index - 1].classList.remove('filled');
        updateConnectButton();
      }

      if (e.key === 'Enter' && getCode().length === 6) {
        handleConnect();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      const numbers = pasted.replace(/\D/g, '').slice(0, 6);

      numbers.split('').forEach((num, i) => {
        if (digits[i]) {
          digits[i].value = num;
          digits[i].classList.add('filled');
        }
      });

      const nextEmpty = Math.min(numbers.length, 5);
      digits[nextEmpty].focus();
      updateConnectButton();
    });
  });

  digits[0].focus();
}

function getCode() {
  return Array.from(document.querySelectorAll('.code-digit')).map(input => input.value).join('');
}

function clearCode() {
  document.querySelectorAll('.code-digit').forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  document.querySelectorAll('.code-digit')[0].focus();
  updateConnectButton();
}

function updateConnectButton() {
  const code = getCode();
  document.getElementById('connect-btn').disabled = code.length !== 6;
}

async function handleConnect() {
  const code = getCode();
  if (code.length !== 6) return;

  document.getElementById('pairing-error').classList.add('hidden');
  showScreen('loading');

  try {
    const response = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      displayId = data.displayId;
      localStorage.setItem(STORAGE_KEY, displayId);
      await loadDisplayData();
      showScreen('editor');
    } else {
      showScreen('pairing');
      const errorEl = document.getElementById('pairing-error');
      errorEl.textContent = data.error || 'Invalid code. Please try again.';
      errorEl.classList.remove('hidden');
      clearCode();
    }
  } catch (error) {
    console.error('Pairing error:', error);
    showScreen('pairing');
    const errorEl = document.getElementById('pairing-error');
    errorEl.textContent = 'Connection failed. Please try again.';
    errorEl.classList.remove('hidden');
  }
}

// ===================
// Data Management
// ===================

async function loadDisplayData() {
  try {
    const response = await fetch(`/api/displays/${displayId}`);

    if (!response.ok) {
      if (response.status === 404) {
        localStorage.removeItem(STORAGE_KEY);
        displayId = null;
        showScreen('pairing');
        showToast('Display not found. Please pair again.', 'error');
        return;
      }
      throw new Error('Failed to load display data');
    }

    const data = await response.json();

    if (data.tableData && data.tableData.feeds) {
      // Domain format
      tableData = {
        settings: data.tableData.settings || {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: data.tableData.feeds || [],
        horses: data.tableData.horses || [],
        diet: data.tableData.diet || {}
      };
    } else {
      // Initialize with empty domain structure
      tableData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0
        },
        feeds: [],
        horses: [],
        diet: {}
      };
    }

    // Restore saved tab
    const savedTab = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (savedTab) {
      currentTab = savedTab;
    }

    updateTimeModeButtons();
    updateZoomDisplay();
    switchTab(currentTab);
    setStatus('Ready');

  } catch (error) {
    console.error('Load error:', error);
    showToast('Failed to load data', 'error');
  }
}

async function saveData(immediate = false) {
  if (!displayId) return;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  const doSave = async () => {
    setStatus('Saving...');
    hasUnsavedChanges = false;

    try {
      const response = await fetch(`/api/displays/${displayId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableData })
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      setStatus('Saved');

    } catch (error) {
      console.error('Save error:', error);
      setStatus('Save failed');
      showToast('Failed to save changes', 'error');
      hasUnsavedChanges = true;
    }
  };

  if (immediate) {
    await doSave();
  } else {
    setStatus('Unsaved changes');
    hasUnsavedChanges = true;
    saveTimeout = setTimeout(doSave, DEBOUNCE_MS);
  }
}

function setStatus(text) {
  document.getElementById('status-text').textContent = text;
}

// ===================
// Utility Functions
// ===================

function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

function formatFraction(value) {
  if (value === null || value === undefined || value === 0) return '';
  const fractions = {
    0.25: '¼', 0.5: '½', 0.75: '¾',
    0.33: '⅓', 0.67: '⅔'
  };
  if (fractions[value]) return fractions[value];
  if (value % 1 === 0) return value.toString();
  const whole = Math.floor(value);
  const frac = value - whole;
  if (fractions[frac]) {
    return whole > 0 ? `${whole}${fractions[frac]}` : fractions[frac];
  }
  return value.toString();
}

function getEffectiveTimeMode() {
  const settings = tableData.settings;
  if (settings.timeMode !== 'AUTO') {
    return settings.timeMode;
  }
  // Auto-detect based on time
  const now = new Date();
  const hour = now.getHours();
  return (hour >= 4 && hour < 12) ? 'AM' : 'PM';
}

function pluralize(unit, count) {
  if (count === 1) return unit;
  if (unit === 'ml') return 'ml';
  return unit + 's';
}

// ===================
// Board Tab
// ===================

function renderBoard() {
  const grid = document.getElementById('board-grid');
  const horsesPerPage = ZOOM_HORSES[tableData.settings.zoomLevel] || 7;
  const currentPage = tableData.settings.currentPage || 0;
  const totalPages = Math.max(1, Math.ceil(tableData.horses.length / horsesPerPage));

  // Ensure current page is valid
  if (currentPage >= totalPages) {
    tableData.settings.currentPage = Math.max(0, totalPages - 1);
  }

  const startIdx = currentPage * horsesPerPage;
  const pageHorses = tableData.horses.slice(startIdx, startIdx + horsesPerPage);

  // Filter feeds that have at least one non-zero value
  const activeFeeds = tableData.feeds.filter(feed => {
    return tableData.horses.some(horse => {
      const horseDiet = tableData.diet[horse.id];
      if (!horseDiet) return false;
      const feedDiet = horseDiet[feed.id];
      if (!feedDiet) return false;
      return feedDiet.am > 0 || feedDiet.pm > 0;
    });
  });

  const timeMode = getEffectiveTimeMode();
  const period = timeMode.toLowerCase();
  const colCount = pageHorses.length + 1; // +1 for feed name column

  grid.style.gridTemplateColumns = `minmax(80px, 1fr) repeat(${pageHorses.length}, minmax(70px, 1fr))`;
  grid.innerHTML = '';

  if (pageHorses.length === 0) {
    grid.innerHTML = '<div class="board-cell empty" style="grid-column: 1/-1; padding: 2rem;">No horses yet. Add horses in the Horses tab.</div>';
    updatePagination();
    return;
  }

  // Header row - horse names
  grid.appendChild(createCell('', 'header'));
  pageHorses.forEach(horse => {
    const cell = createCell(horse.name, 'header');
    cell.dataset.horseId = horse.id;
    cell.addEventListener('click', () => openHorseModal(horse.id));
    cell.style.cursor = 'pointer';
    grid.appendChild(cell);
  });

  // Feed rows
  if (activeFeeds.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'board-cell empty';
    emptyRow.style.gridColumn = '1 / -1';
    emptyRow.style.padding = '2rem';
    emptyRow.textContent = 'No feeds with values. Add feeds in the Feeds tab.';
    grid.appendChild(emptyRow);
  } else {
    activeFeeds.forEach(feed => {
      // Feed name
      grid.appendChild(createCell(feed.name, 'feed-name'));

      // Quantity cells for each horse
      pageHorses.forEach(horse => {
        const horseDiet = tableData.diet[horse.id] || {};
        const feedDiet = horseDiet[feed.id] || {};
        const value = feedDiet[period];
        const displayValue = formatFraction(value);

        const cell = createCell(displayValue || '', 'quantity');
        cell.dataset.horseId = horse.id;
        cell.dataset.feedId = feed.id;
        cell.dataset.period = period;
        if (!displayValue) cell.classList.add('empty');

        cell.addEventListener('click', () => {
          openQuantityModal(horse.id, feed.id, period);
        });

        grid.appendChild(cell);
      });
    });
  }

  // Notes row
  grid.appendChild(createCell('Notes', 'feed-name'));
  pageHorses.forEach(horse => {
    const cell = createCell(horse.note || '', 'note');
    cell.dataset.horseId = horse.id;
    if (!horse.note) cell.classList.add('empty');

    cell.addEventListener('click', () => {
      openNoteModal(horse.id);
    });

    grid.appendChild(cell);
  });

  updatePagination();
}

function createCell(content, className) {
  const cell = document.createElement('div');
  cell.className = `board-cell ${className}`;
  cell.textContent = content;
  return cell;
}

function updateTimeModeButtons() {
  const mode = tableData.settings.timeMode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function updateZoomDisplay() {
  const horsesPerPage = ZOOM_HORSES[tableData.settings.zoomLevel] || 7;
  document.getElementById('zoom-level').textContent = `${horsesPerPage} horses`;
}

function updatePagination() {
  const horsesPerPage = ZOOM_HORSES[tableData.settings.zoomLevel] || 7;
  const totalPages = Math.max(1, Math.ceil(tableData.horses.length / horsesPerPage));
  const currentPage = tableData.settings.currentPage || 0;

  document.getElementById('page-indicator').textContent = `Page ${currentPage + 1} of ${totalPages}`;
  document.getElementById('page-prev').disabled = currentPage === 0;
  document.getElementById('page-next').disabled = currentPage >= totalPages - 1;
}

function setTimeMode(mode) {
  tableData.settings.timeMode = mode;
  if (mode !== 'AUTO') {
    // Set override expiry to 1 hour from now
    tableData.settings.overrideUntil = Date.now() + 60 * 60 * 1000;
  } else {
    tableData.settings.overrideUntil = null;
  }
  updateTimeModeButtons();
  renderBoard();
  saveData();
}

function changeZoom(delta) {
  const newZoom = Math.max(1, Math.min(3, tableData.settings.zoomLevel + delta));
  if (newZoom !== tableData.settings.zoomLevel) {
    tableData.settings.zoomLevel = newZoom;
    tableData.settings.currentPage = 0; // Reset to first page
    updateZoomDisplay();
    renderBoard();
    saveData();
  }
}

function changePage(delta) {
  const horsesPerPage = ZOOM_HORSES[tableData.settings.zoomLevel] || 7;
  const totalPages = Math.max(1, Math.ceil(tableData.horses.length / horsesPerPage));
  const newPage = Math.max(0, Math.min(totalPages - 1, tableData.settings.currentPage + delta));

  if (newPage !== tableData.settings.currentPage) {
    tableData.settings.currentPage = newPage;
    renderBoard();
    saveData();
  }
}

// ===================
// Quantity Modal
// ===================

function openQuantityModal(horseId, feedId, period) {
  editingQuantity = { horseId, feedId, period };

  const horse = tableData.horses.find(h => h.id === horseId);
  const feed = tableData.feeds.find(f => f.id === feedId);
  const horseDiet = tableData.diet[horseId] || {};
  const feedDiet = horseDiet[feedId] || {};
  const currentValue = feedDiet[period] || '';

  document.getElementById('quantity-title').textContent = `${horse.name} - ${feed.name} (${period.toUpperCase()})`;
  document.getElementById('quantity-input').value = currentValue;
  document.getElementById('quantity-unit').textContent = pluralize(feed.unit, 2);

  document.getElementById('quantity-modal').classList.remove('hidden');
  document.getElementById('quantity-input').focus();
  document.getElementById('quantity-input').select();
}

function closeQuantityModal() {
  document.getElementById('quantity-modal').classList.add('hidden');
  editingQuantity = { horseId: null, feedId: null, period: null };
}

function saveQuantity() {
  const { horseId, feedId, period } = editingQuantity;
  const inputValue = document.getElementById('quantity-input').value;
  const value = inputValue === '' ? null : parseFloat(inputValue);

  // Ensure diet structure exists
  if (!tableData.diet[horseId]) {
    tableData.diet[horseId] = {};
  }
  if (!tableData.diet[horseId][feedId]) {
    tableData.diet[horseId][feedId] = { am: null, pm: null };
  }

  tableData.diet[horseId][feedId][period] = value;

  // Clean up null entries
  if (tableData.diet[horseId][feedId].am === null && tableData.diet[horseId][feedId].pm === null) {
    delete tableData.diet[horseId][feedId];
  }
  if (Object.keys(tableData.diet[horseId]).length === 0) {
    delete tableData.diet[horseId];
  }

  closeQuantityModal();
  renderBoard();
  saveData();
}

function clearQuantity() {
  document.getElementById('quantity-input').value = '';
}

// ===================
// Note Modal
// ===================

function openNoteModal(horseId) {
  editingNote = { horseId };

  const horse = tableData.horses.find(h => h.id === horseId);

  document.getElementById('note-horse-name').textContent = horse.name;
  document.getElementById('note-input').value = horse.note || '';

  // Determine current expiry setting
  let expiryValue = '';
  if (horse.noteExpiry) {
    const hoursUntilExpiry = Math.round((horse.noteExpiry - Date.now()) / (1000 * 60 * 60));
    if (hoursUntilExpiry > 36) {
      expiryValue = '48';
    } else if (hoursUntilExpiry > 0) {
      expiryValue = '24';
    }
  }
  document.getElementById('note-expiry-select').value = expiryValue;

  document.getElementById('note-modal').classList.remove('hidden');
  document.getElementById('note-input').focus();
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.add('hidden');
  editingNote = { horseId: null };
}

function saveNote() {
  const { horseId } = editingNote;
  const horse = tableData.horses.find(h => h.id === horseId);

  const noteText = document.getElementById('note-input').value.trim();
  const expiryHours = document.getElementById('note-expiry-select').value;

  horse.note = noteText;
  if (noteText && expiryHours) {
    horse.noteExpiry = Date.now() + parseInt(expiryHours) * 60 * 60 * 1000;
    horse.noteCreatedAt = Date.now();
  } else {
    horse.noteExpiry = null;
    if (noteText) {
      horse.noteCreatedAt = horse.noteCreatedAt || Date.now();
    } else {
      horse.noteCreatedAt = null;
    }
  }

  closeNoteModal();
  renderCurrentTab();
  saveData();
}

// ===================
// Horses Tab
// ===================

function renderHorsesList() {
  const list = document.getElementById('horses-list');
  list.innerHTML = '';

  if (tableData.horses.length === 0) {
    list.innerHTML = '<div class="reports-empty">No horses yet. Tap the button below to add one.</div>';
    return;
  }

  tableData.horses.forEach(horse => {
    const card = document.createElement('div');
    card.className = 'horse-card';
    card.dataset.horseId = horse.id;

    // Count active feeds
    const horseDiet = tableData.diet[horse.id] || {};
    const activeFeedCount = Object.keys(horseDiet).filter(feedId => {
      const fd = horseDiet[feedId];
      return fd && (fd.am > 0 || fd.pm > 0);
    }).length;

    let html = `
      <div class="horse-card-header">
        <span class="horse-card-name">${horse.name}</span>
        <span class="horse-card-feeds">${activeFeedCount} feed${activeFeedCount !== 1 ? 's' : ''}</span>
      </div>
    `;

    if (horse.note) {
      const isStale = horse.noteCreatedAt && !horse.noteExpiry &&
        (Date.now() - horse.noteCreatedAt) > 24 * 60 * 60 * 1000;
      html += `<div class="horse-card-note${isStale ? ' stale' : ''}">${horse.note}</div>`;
    }

    card.innerHTML = html;
    card.addEventListener('click', () => openHorseModal(horse.id));
    list.appendChild(card);
  });
}

function openHorseModal(horseId) {
  const isNew = !horseId;
  editingHorse = { id: horseId, isNew };

  const modal = document.getElementById('horse-modal');
  const title = document.getElementById('horse-modal-title');
  const nameInput = document.getElementById('horse-name-input');
  const cloneSelect = document.getElementById('clone-diet-select');
  const noteInput = document.getElementById('horse-note-input');
  const noteExpiry = document.getElementById('horse-note-expiry');
  const deleteBtn = modal.querySelector('.delete-horse-btn');
  const warningEl = document.getElementById('stale-note-warning');

  if (isNew) {
    title.textContent = 'Add Horse';
    nameInput.value = '';
    noteInput.value = '';
    noteExpiry.value = '';
    deleteBtn.classList.add('hidden');
    warningEl.classList.add('hidden');
  } else {
    const horse = tableData.horses.find(h => h.id === horseId);
    title.textContent = 'Edit Horse';
    nameInput.value = horse.name;
    noteInput.value = horse.note || '';

    // Expiry
    let expiryValue = '';
    if (horse.noteExpiry) {
      const hoursUntilExpiry = Math.round((horse.noteExpiry - Date.now()) / (1000 * 60 * 60));
      if (hoursUntilExpiry > 36) expiryValue = '48';
      else if (hoursUntilExpiry > 0) expiryValue = '24';
    }
    noteExpiry.value = expiryValue;

    // Stale warning
    const isStale = horse.note && horse.noteCreatedAt && !horse.noteExpiry &&
      (Date.now() - horse.noteCreatedAt) > 24 * 60 * 60 * 1000;
    warningEl.classList.toggle('hidden', !isStale);

    deleteBtn.classList.remove('hidden');
  }

  // Populate clone dropdown
  cloneSelect.innerHTML = '<option value="">-- Select horse --</option>';
  tableData.horses.filter(h => h.id !== horseId).forEach(h => {
    const option = document.createElement('option');
    option.value = h.id;
    option.textContent = h.name;
    cloneSelect.appendChild(option);
  });

  // Render feeds in horse modal
  renderHorseFeedsInModal(horseId);

  modal.classList.remove('hidden');
  nameInput.focus();
}

function renderHorseFeedsInModal(horseId) {
  const activeContainer = document.getElementById('horse-active-feeds');
  const inactiveContainer = document.getElementById('horse-inactive-feeds');

  activeContainer.innerHTML = '';
  inactiveContainer.innerHTML = '';

  const horseDiet = horseId ? (tableData.diet[horseId] || {}) : {};

  // Active feeds (have values)
  const activeFeeds = tableData.feeds.filter(feed => {
    const fd = horseDiet[feed.id];
    return fd && (fd.am !== null || fd.pm !== null);
  });

  // Inactive feeds
  const inactiveFeeds = tableData.feeds.filter(feed => {
    const fd = horseDiet[feed.id];
    return !fd || (fd.am === null && fd.pm === null);
  });

  if (activeFeeds.length === 0) {
    activeContainer.innerHTML = '<div class="reports-empty" style="padding: 0.5rem;">No feeds assigned</div>';
  } else {
    activeFeeds.forEach(feed => {
      const fd = horseDiet[feed.id] || { am: null, pm: null };
      activeContainer.appendChild(createHorseFeedRow(feed, fd, horseId));
    });
  }

  if (inactiveFeeds.length === 0) {
    inactiveContainer.innerHTML = '<div class="reports-empty" style="padding: 0.5rem;">All feeds assigned</div>';
  } else {
    inactiveFeeds.forEach(feed => {
      const row = document.createElement('div');
      row.className = 'horse-feed-row';
      row.innerHTML = `<span class="horse-feed-name">${feed.name}</span><span class="horse-feed-unit">Tap to add</span>`;
      row.addEventListener('click', () => {
        // Add this feed to the horse
        if (!tableData.diet[horseId]) tableData.diet[horseId] = {};
        tableData.diet[horseId][feed.id] = { am: 0, pm: 0 };
        renderHorseFeedsInModal(horseId);
      });
      inactiveContainer.appendChild(row);
    });
  }
}

function createHorseFeedRow(feed, dietData, horseId) {
  const row = document.createElement('div');
  row.className = 'horse-feed-row';
  row.innerHTML = `
    <span class="horse-feed-name">${feed.name}</span>
    <div class="horse-feed-inputs">
      <input type="number" step="0.25" min="0" value="${dietData.am || ''}" data-period="am" data-feed-id="${feed.id}">
      <span>AM</span>
      <input type="number" step="0.25" min="0" value="${dietData.pm || ''}" data-period="pm" data-feed-id="${feed.id}">
      <span>PM</span>
    </div>
    <span class="horse-feed-unit">${feed.unit}</span>
  `;

  // Add change listeners
  row.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const period = input.dataset.period;
      const feedId = input.dataset.feedId;
      const value = input.value === '' ? null : parseFloat(input.value);

      if (!tableData.diet[horseId]) tableData.diet[horseId] = {};
      if (!tableData.diet[horseId][feedId]) tableData.diet[horseId][feedId] = { am: null, pm: null };
      tableData.diet[horseId][feedId][period] = value;
    });
  });

  return row;
}

function closeHorseModal() {
  document.getElementById('horse-modal').classList.add('hidden');
  editingHorse = { id: null, isNew: false };
}

function saveHorse() {
  const { id, isNew } = editingHorse;
  const name = document.getElementById('horse-name-input').value.trim();

  if (!name) {
    showToast('Please enter a horse name', 'error');
    return;
  }

  const note = document.getElementById('horse-note-input').value.trim();
  const expiryHours = document.getElementById('horse-note-expiry').value;
  const cloneFromId = document.getElementById('clone-diet-select').value;

  let horse;
  if (isNew) {
    horse = {
      id: generateId(),
      name,
      note: note || '',
      noteExpiry: null,
      noteCreatedAt: null
    };
    tableData.horses.push(horse);

    // Clone diet if selected
    if (cloneFromId && tableData.diet[cloneFromId]) {
      tableData.diet[horse.id] = JSON.parse(JSON.stringify(tableData.diet[cloneFromId]));
    }
  } else {
    horse = tableData.horses.find(h => h.id === id);
    horse.name = name;
  }

  // Update note
  horse.note = note;
  if (note && expiryHours) {
    horse.noteExpiry = Date.now() + parseInt(expiryHours) * 60 * 60 * 1000;
    horse.noteCreatedAt = horse.noteCreatedAt || Date.now();
  } else {
    horse.noteExpiry = null;
    if (note) {
      horse.noteCreatedAt = horse.noteCreatedAt || Date.now();
    }
  }

  // If editing, collect diet changes from modal inputs
  if (!isNew) {
    document.querySelectorAll('#horse-active-feeds .horse-feed-row input').forEach(input => {
      const period = input.dataset.period;
      const feedId = input.dataset.feedId;
      const value = input.value === '' ? null : parseFloat(input.value);

      if (!tableData.diet[id]) tableData.diet[id] = {};
      if (!tableData.diet[id][feedId]) tableData.diet[id][feedId] = { am: null, pm: null };
      tableData.diet[id][feedId][period] = value;
    });

    // Clean up empty diet entries
    if (tableData.diet[id]) {
      Object.keys(tableData.diet[id]).forEach(feedId => {
        const fd = tableData.diet[id][feedId];
        if (fd.am === null && fd.pm === null) {
          delete tableData.diet[id][feedId];
        }
      });
      if (Object.keys(tableData.diet[id]).length === 0) {
        delete tableData.diet[id];
      }
    }
  }

  closeHorseModal();
  renderCurrentTab();
  saveData();
}

function confirmDeleteHorse() {
  const horse = tableData.horses.find(h => h.id === editingHorse.id);
  deleteTarget = { type: 'horse', id: editingHorse.id };

  document.getElementById('delete-title').textContent = 'Delete Horse?';
  document.getElementById('delete-message').textContent = `Delete "${horse.name}"? This will also remove all diet entries for this horse.`;
  document.getElementById('delete-modal').classList.remove('hidden');
}

// ===================
// Feeds Tab
// ===================

function renderFeedsList() {
  const list = document.getElementById('feeds-list');
  list.innerHTML = '';

  if (tableData.feeds.length === 0) {
    list.innerHTML = '<div class="reports-empty">No feeds yet. Tap the button below to add one.</div>';
    return;
  }

  // Sort by rank
  const sortedFeeds = [...tableData.feeds].sort((a, b) => (a.rank || 999) - (b.rank || 999));

  sortedFeeds.forEach(feed => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.dataset.feedId = feed.id;
    item.innerHTML = `
      <span class="feed-item-name">${feed.name}</span>
      <span class="feed-item-unit">${feed.unit}</span>
    `;
    item.addEventListener('click', () => openFeedModal(feed.id));
    list.appendChild(item);
  });
}

function openFeedModal(feedId) {
  const isNew = !feedId;
  editingFeed = { id: feedId, isNew };

  const modal = document.getElementById('feed-modal');
  const title = document.getElementById('feed-modal-title');
  const nameInput = document.getElementById('feed-name-input');
  const unitSelect = document.getElementById('feed-unit-select');
  const deleteBtn = modal.querySelector('.delete-feed-btn');

  if (isNew) {
    title.textContent = 'Add Feed';
    nameInput.value = '';
    unitSelect.value = 'scoop';
    deleteBtn.classList.add('hidden');
  } else {
    const feed = tableData.feeds.find(f => f.id === feedId);
    title.textContent = 'Edit Feed';
    nameInput.value = feed.name;
    unitSelect.value = feed.unit;
    deleteBtn.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
  nameInput.focus();
}

function closeFeedModal() {
  document.getElementById('feed-modal').classList.add('hidden');
  editingFeed = { id: null, isNew: false };
}

function saveFeed() {
  const { id, isNew } = editingFeed;
  const name = document.getElementById('feed-name-input').value.trim();
  const unit = document.getElementById('feed-unit-select').value;

  if (!name) {
    showToast('Please enter a feed name', 'error');
    return;
  }

  if (isNew) {
    const feed = {
      id: generateId(),
      name,
      unit,
      rank: tableData.feeds.length + 1
    };
    tableData.feeds.push(feed);
  } else {
    const feed = tableData.feeds.find(f => f.id === id);
    feed.name = name;
    feed.unit = unit;
  }

  closeFeedModal();
  renderCurrentTab();
  saveData();
}

function confirmDeleteFeed() {
  const feed = tableData.feeds.find(f => f.id === editingFeed.id);
  deleteTarget = { type: 'feed', id: editingFeed.id };

  document.getElementById('delete-title').textContent = 'Delete Feed?';
  document.getElementById('delete-message').textContent = `Delete "${feed.name}"? This will remove it from all horses' diets.`;
  document.getElementById('delete-modal').classList.remove('hidden');
}

// ===================
// Delete Confirmation
// ===================

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  deleteTarget = { type: null, id: null };
}

function executeDelete() {
  const { type, id } = deleteTarget;

  if (type === 'horse') {
    tableData.horses = tableData.horses.filter(h => h.id !== id);
    delete tableData.diet[id];
    closeHorseModal();
  } else if (type === 'feed') {
    tableData.feeds = tableData.feeds.filter(f => f.id !== id);
    // Remove from all diets
    Object.keys(tableData.diet).forEach(horseId => {
      delete tableData.diet[horseId][id];
      if (Object.keys(tableData.diet[horseId]).length === 0) {
        delete tableData.diet[horseId];
      }
    });
    closeFeedModal();
  }

  closeDeleteModal();
  renderCurrentTab();
  saveData();
}

// ===================
// Reports Tab
// ===================

function renderReports() {
  const tbody = document.getElementById('reports-body');
  tbody.innerHTML = '';

  if (tableData.feeds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="reports-empty">No feeds to report on.</td></tr>';
    return;
  }

  // Calculate weekly consumption for each feed
  const consumption = {};
  tableData.feeds.forEach(feed => {
    consumption[feed.id] = 0;
  });

  // Sum all AM + PM values across all horses
  Object.values(tableData.diet).forEach(horseDiet => {
    Object.entries(horseDiet).forEach(([feedId, values]) => {
      if (consumption[feedId] !== undefined) {
        consumption[feedId] += (values.am || 0) + (values.pm || 0);
      }
    });
  });

  // Multiply by 7 for weekly total
  tableData.feeds.forEach(feed => {
    const daily = consumption[feed.id];
    const weekly = (daily * 7).toFixed(2);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${feed.name}</td>
      <td>${weekly}</td>
      <td>${pluralize(feed.unit, parseFloat(weekly))}</td>
    `;
    tbody.appendChild(row);
  });
}

// ===================
// Navigation
// ===================

function handleBack() {
  if (hasUnsavedChanges) {
    saveData(true);
  }

  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(TAB_STORAGE_KEY);
  displayId = null;
  tableData = {
    settings: { timezone: 'Australia/Sydney', timeMode: 'AUTO', overrideUntil: null, zoomLevel: 2, currentPage: 0 },
    feeds: [],
    horses: [],
    diet: {}
  };
  currentTab = 'board';

  clearCode();
  document.getElementById('pairing-error').classList.add('hidden');
  showScreen('pairing');
}

// ===================
// Initialization
// ===================

async function init() {
  setupPairingInputs();

  // Pairing
  document.getElementById('connect-btn').addEventListener('click', handleConnect);

  // Header buttons
  document.getElementById('back-btn').addEventListener('click', handleBack);
  document.getElementById('save-btn').addEventListener('click', () => saveData(true));

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Board controls
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeMode(btn.dataset.mode));
  });
  document.getElementById('zoom-out').addEventListener('click', () => changeZoom(1));
  document.getElementById('zoom-in').addEventListener('click', () => changeZoom(-1));
  document.getElementById('page-prev').addEventListener('click', () => changePage(-1));
  document.getElementById('page-next').addEventListener('click', () => changePage(1));

  // Add buttons
  document.getElementById('add-horse-btn').addEventListener('click', () => openHorseModal(null));
  document.getElementById('add-feed-btn').addEventListener('click', () => openFeedModal(null));

  // Quantity modal
  const qtyModal = document.getElementById('quantity-modal');
  qtyModal.querySelector('.modal-close-btn').addEventListener('click', closeQuantityModal);
  qtyModal.querySelector('.clear-qty-btn').addEventListener('click', clearQuantity);
  qtyModal.querySelector('.save-qty-btn').addEventListener('click', saveQuantity);
  qtyModal.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('quantity-input').value = btn.dataset.value;
    });
  });
  document.getElementById('quantity-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveQuantity();
    if (e.key === 'Escape') closeQuantityModal();
  });
  qtyModal.addEventListener('click', (e) => {
    if (e.target === qtyModal) closeQuantityModal();
  });

  // Note modal
  const noteModal = document.getElementById('note-modal');
  noteModal.querySelector('.modal-close-btn').addEventListener('click', closeNoteModal);
  noteModal.querySelector('.modal-cancel-btn').addEventListener('click', closeNoteModal);
  noteModal.querySelector('.save-note-btn').addEventListener('click', saveNote);
  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) closeNoteModal();
  });

  // Horse modal
  const horseModal = document.getElementById('horse-modal');
  horseModal.querySelector('.modal-close-btn').addEventListener('click', closeHorseModal);
  horseModal.querySelector('.save-horse-btn').addEventListener('click', saveHorse);
  horseModal.querySelector('.delete-horse-btn').addEventListener('click', confirmDeleteHorse);
  horseModal.addEventListener('click', (e) => {
    if (e.target === horseModal) closeHorseModal();
  });

  // Feed modal
  const feedModal = document.getElementById('feed-modal');
  feedModal.querySelector('.modal-close-btn').addEventListener('click', closeFeedModal);
  feedModal.querySelector('.modal-cancel-btn').addEventListener('click', closeFeedModal);
  feedModal.querySelector('.save-feed-btn').addEventListener('click', saveFeed);
  feedModal.querySelector('.delete-feed-btn').addEventListener('click', confirmDeleteFeed);
  feedModal.addEventListener('click', (e) => {
    if (e.target === feedModal) closeFeedModal();
  });

  // Delete modal
  document.getElementById('delete-cancel').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-confirm').addEventListener('click', executeDelete);
  document.getElementById('delete-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
  });

  // Check for existing session
  const storedId = localStorage.getItem(STORAGE_KEY);

  if (storedId) {
    displayId = storedId;
    showScreen('loading');

    try {
      const response = await fetch(`/api/displays/${storedId}`);

      if (response.ok) {
        await loadDisplayData();
        showScreen('editor');
        return;
      }
    } catch (error) {
      console.error('Session restore error:', error);
    }

    localStorage.removeItem(STORAGE_KEY);
    displayId = null;
  }

  showScreen('pairing');
}

// ===================
// PWA Install Prompt
// ===================

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const banner = document.getElementById('install-banner');
  if (banner && !localStorage.getItem('horseboard_install_dismissed')) {
    banner.classList.remove('hidden');
  }
});

function setupInstallPrompt() {
  const banner = document.getElementById('install-banner');
  const installBtn = document.getElementById('install-btn');
  const dismissBtn = document.getElementById('dismiss-install');

  if (!banner || !installBtn || !dismissBtn) return;

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install prompt outcome:', outcome);

    deferredPrompt = null;
    banner.classList.add('hidden');
  });

  dismissBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
    localStorage.setItem('horseboard_install_dismissed', 'true');
  });

  if (localStorage.getItem('horseboard_install_dismissed')) {
    banner.classList.add('hidden');
  }
}

window.addEventListener('appinstalled', () => {
  console.log('App installed');
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.classList.add('hidden');
  }
  deferredPrompt = null;
});

// Start application
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupInstallPrompt();
});
