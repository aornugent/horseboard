/**
 * Mobile Controller Application
 *
 * Handles:
 * - Pairing with TV display via 6-digit code
 * - Table editing (add/edit/delete rows and columns)
 * - Column sorting
 * - TV display settings (pagination)
 */

const STORAGE_KEY = 'horseboard_controller_display_id';
const DEBOUNCE_MS = 500;

// State
let displayId = null;
let tableData = {
  headers: [],
  rows: [],
  displaySettings: {
    startRow: 0,
    rowCount: 10
  }
};
let sortState = {
  column: null,
  direction: null // 'asc', 'desc', or null
};
let hasUnsavedChanges = false;
let saveTimeout = null;

// Cell edit state
let editingCell = {
  row: null,
  col: null,
  isHeader: false
};

// Delete state
let deleteTarget = {
  type: null, // 'row' or 'column'
  index: null
};

// DOM Elements
const screens = {
  pairing: document.getElementById('pairing-screen'),
  loading: document.getElementById('loading-screen'),
  editor: document.getElementById('editor-screen')
};

const elements = {
  codeInputs: document.getElementById('code-inputs'),
  codeDigits: document.querySelectorAll('.code-digit'),
  connectBtn: document.getElementById('connect-btn'),
  pairingError: document.getElementById('pairing-error'),
  backBtn: document.getElementById('back-btn'),
  saveBtn: document.getElementById('save-btn'),
  editorHead: document.getElementById('editor-head'),
  editorBody: document.getElementById('editor-body'),
  addRowBtn: document.getElementById('add-row-btn'),
  addColumnBtn: document.getElementById('add-column-btn'),
  startRowInput: document.getElementById('start-row'),
  rowCountInput: document.getElementById('row-count'),
  statusText: document.getElementById('status-text'),
  cellModal: document.getElementById('cell-modal'),
  modalTitle: document.getElementById('modal-title'),
  cellInput: document.getElementById('cell-input'),
  modalClose: document.getElementById('modal-close'),
  modalCancel: document.getElementById('modal-cancel'),
  modalSave: document.getElementById('modal-save'),
  deleteModal: document.getElementById('delete-modal'),
  deleteTitle: document.getElementById('delete-title'),
  deleteMessage: document.getElementById('delete-message'),
  deleteCancel: document.getElementById('delete-cancel'),
  deleteConfirm: document.getElementById('delete-confirm'),
  toast: document.getElementById('toast')
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
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  elements.toast.textContent = message;
  elements.toast.className = 'toast';
  if (type !== 'info') {
    elements.toast.classList.add(type);
  }

  toastTimeout = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

// ===================
// Pairing Logic
// ===================

function setupPairingInputs() {
  const digits = elements.codeDigits;

  digits.forEach((input, index) => {
    // Handle input
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      e.target.value = value.slice(-1); // Keep only last digit

      if (value && index < 5) {
        digits[index + 1].focus();
      }

      e.target.classList.toggle('filled', value.length > 0);
      updateConnectButton();
    });

    // Handle backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        digits[index - 1].focus();
        digits[index - 1].value = '';
        digits[index - 1].classList.remove('filled');
        updateConnectButton();
      }

      // Allow Enter to submit
      if (e.key === 'Enter' && getCode().length === 6) {
        handleConnect();
      }
    });

    // Handle paste
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

      // Focus appropriate field
      const nextEmpty = Math.min(numbers.length, 5);
      digits[nextEmpty].focus();
      updateConnectButton();
    });
  });

  // Focus first input
  digits[0].focus();
}

function getCode() {
  return Array.from(elements.codeDigits).map(input => input.value).join('');
}

function clearCode() {
  elements.codeDigits.forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  elements.codeDigits[0].focus();
  updateConnectButton();
}

function updateConnectButton() {
  const code = getCode();
  elements.connectBtn.disabled = code.length !== 6;
}

async function handleConnect() {
  const code = getCode();
  if (code.length !== 6) return;

  elements.pairingError.classList.add('hidden');
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
      elements.pairingError.textContent = data.error || 'Invalid code. Please try again.';
      elements.pairingError.classList.remove('hidden');
      clearCode();
    }
  } catch (error) {
    console.error('Pairing error:', error);
    showScreen('pairing');
    elements.pairingError.textContent = 'Connection failed. Please try again.';
    elements.pairingError.classList.remove('hidden');
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
        // Display no longer exists
        localStorage.removeItem(STORAGE_KEY);
        displayId = null;
        showScreen('pairing');
        showToast('Display not found. Please pair again.', 'error');
        return;
      }
      throw new Error('Failed to load display data');
    }

    const data = await response.json();

    // Initialize with existing data or empty table
    if (data.tableData) {
      tableData = {
        headers: data.tableData.headers || [],
        rows: data.tableData.rows || [],
        displaySettings: data.tableData.displaySettings || {
          startRow: 0,
          rowCount: 10
        }
      };
    } else {
      // Start with empty table with one column
      tableData = {
        headers: ['Column 1'],
        rows: [['']],
        displaySettings: {
          startRow: 0,
          rowCount: 10
        }
      };
    }

    // Update TV settings inputs
    elements.startRowInput.value = (tableData.displaySettings.startRow || 0) + 1;
    elements.rowCountInput.value = tableData.displaySettings.rowCount || 10;

    renderTable();
    setStatus('Ready');

  } catch (error) {
    console.error('Load error:', error);
    showToast('Failed to load data', 'error');
  }
}

async function saveData(immediate = false) {
  if (!displayId) return;

  // Cancel pending save
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
    // Debounce save
    setStatus('Unsaved changes');
    hasUnsavedChanges = true;
    saveTimeout = setTimeout(doSave, DEBOUNCE_MS);
  }
}

function setStatus(text) {
  elements.statusText.textContent = text;
}

// ===================
// Table Rendering
// ===================

function renderTable() {
  renderHeaders();
  renderBody();
}

function renderHeaders() {
  elements.editorHead.innerHTML = '';

  if (tableData.headers.length === 0) {
    return;
  }

  const tr = document.createElement('tr');

  tableData.headers.forEach((header, colIndex) => {
    const th = document.createElement('th');
    th.dataset.col = colIndex;

    // Header text
    const textSpan = document.createElement('span');
    textSpan.className = 'header-text';
    textSpan.textContent = header || `Column ${colIndex + 1}`;
    th.appendChild(textSpan);

    // Sort indicator
    const sortSpan = document.createElement('span');
    sortSpan.className = 'sort-indicator';
    th.appendChild(sortSpan);

    // Apply sort class
    if (sortState.column === colIndex) {
      th.classList.add(sortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }

    // Delete button (only if more than one column)
    if (tableData.headers.length > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-col';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'Delete column';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDelete('column', colIndex);
      });
      th.appendChild(deleteBtn);
    }

    // Click to edit header
    th.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-col')) return;
      // Double-click to edit, single click to sort
      openCellModal(null, colIndex, true);
    });

    // Long press or right-click for sort menu could be added later
    // For now, we'll put sort in header tap

    tr.appendChild(th);
  });

  // Actions column header (empty)
  const actionTh = document.createElement('th');
  actionTh.className = 'row-actions';
  tr.appendChild(actionTh);

  elements.editorHead.appendChild(tr);
}

function renderBody() {
  elements.editorBody.innerHTML = '';

  if (tableData.rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = tableData.headers.length + 1;
    td.className = 'empty-table';
    td.innerHTML = '<p>No data yet</p><p>Tap "Add Row" to get started</p>';
    tr.appendChild(td);
    elements.editorBody.appendChild(tr);
    return;
  }

  tableData.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    tr.dataset.row = rowIndex;

    // Data cells
    for (let colIndex = 0; colIndex < tableData.headers.length; colIndex++) {
      const td = document.createElement('td');
      td.dataset.row = rowIndex;
      td.dataset.col = colIndex;
      td.textContent = row[colIndex] !== undefined ? row[colIndex] : '';

      td.addEventListener('click', () => {
        openCellModal(rowIndex, colIndex, false);
      });

      tr.appendChild(td);
    }

    // Delete row button
    const actionTd = document.createElement('td');
    actionTd.className = 'row-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Delete row';
    deleteBtn.addEventListener('click', () => {
      confirmDelete('row', rowIndex);
    });
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);

    elements.editorBody.appendChild(tr);
  });
}

// ===================
// Cell Editing
// ===================

function openCellModal(row, col, isHeader) {
  editingCell = { row, col, isHeader };

  if (isHeader) {
    elements.modalTitle.textContent = 'Edit Column Header';
    elements.cellInput.value = tableData.headers[col] || '';
  } else {
    elements.modalTitle.textContent = 'Edit Cell';
    elements.cellInput.value = tableData.rows[row]?.[col] || '';
  }

  elements.cellModal.classList.remove('hidden');
  elements.cellInput.focus();
  elements.cellInput.select();
}

function closeCellModal() {
  elements.cellModal.classList.add('hidden');
  editingCell = { row: null, col: null, isHeader: false };
}

function saveCellEdit() {
  const { row, col, isHeader } = editingCell;
  const value = elements.cellInput.value;

  if (isHeader) {
    tableData.headers[col] = value;
  } else {
    // Ensure row array has enough columns
    while (tableData.rows[row].length < tableData.headers.length) {
      tableData.rows[row].push('');
    }
    tableData.rows[row][col] = value;
  }

  closeCellModal();
  renderTable();
  saveData();
}

// ===================
// Row/Column Management
// ===================

function addRow() {
  const newRow = new Array(tableData.headers.length).fill('');
  tableData.rows.push(newRow);
  renderTable();
  saveData();

  // Scroll to bottom
  const wrapper = document.querySelector('.table-wrapper');
  wrapper.scrollTop = wrapper.scrollHeight;
}

function addColumn() {
  const colNum = tableData.headers.length + 1;
  tableData.headers.push(`Column ${colNum}`);

  // Add empty cell to each row
  tableData.rows.forEach(row => {
    row.push('');
  });

  renderTable();
  saveData();

  // Scroll to right
  const wrapper = document.querySelector('.table-wrapper');
  wrapper.scrollLeft = wrapper.scrollWidth;
}

function confirmDelete(type, index) {
  deleteTarget = { type, index };

  if (type === 'row') {
    elements.deleteTitle.textContent = 'Delete Row?';
    elements.deleteMessage.textContent = `Delete row ${index + 1}? This cannot be undone.`;
  } else {
    elements.deleteTitle.textContent = 'Delete Column?';
    elements.deleteMessage.textContent = `Delete "${tableData.headers[index]}"? This cannot be undone.`;
  }

  elements.deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  elements.deleteModal.classList.add('hidden');
  deleteTarget = { type: null, index: null };
}

function executeDelete() {
  const { type, index } = deleteTarget;

  if (type === 'row') {
    tableData.rows.splice(index, 1);
  } else if (type === 'column') {
    tableData.headers.splice(index, 1);
    tableData.rows.forEach(row => {
      row.splice(index, 1);
    });

    // Reset sort if we deleted the sorted column
    if (sortState.column === index) {
      sortState = { column: null, direction: null };
    } else if (sortState.column !== null && sortState.column > index) {
      sortState.column--;
    }
  }

  closeDeleteModal();
  renderTable();
  saveData();
}

// ===================
// Sorting
// ===================

function toggleSort(colIndex) {
  if (sortState.column === colIndex) {
    // Cycle: asc -> desc -> none
    if (sortState.direction === 'asc') {
      sortState.direction = 'desc';
    } else if (sortState.direction === 'desc') {
      sortState = { column: null, direction: null };
    } else {
      sortState.direction = 'asc';
    }
  } else {
    sortState = { column: colIndex, direction: 'asc' };
  }

  if (sortState.column !== null) {
    sortRows();
  }

  renderTable();
  saveData();
}

function sortRows() {
  const { column, direction } = sortState;
  if (column === null) return;

  tableData.rows.sort((a, b) => {
    const valA = (a[column] || '').toString().toLowerCase();
    const valB = (b[column] || '').toString().toLowerCase();

    let comparison = valA.localeCompare(valB, undefined, { numeric: true });

    return direction === 'desc' ? -comparison : comparison;
  });
}

// ===================
// TV Display Settings
// ===================

function updateDisplaySettings() {
  const startRow = Math.max(0, parseInt(elements.startRowInput.value, 10) - 1) || 0;
  const rowCount = Math.max(1, parseInt(elements.rowCountInput.value, 10)) || 10;

  tableData.displaySettings = {
    startRow,
    rowCount
  };

  saveData();
}

// ===================
// Navigation
// ===================

function handleBack() {
  if (hasUnsavedChanges) {
    // Save before leaving
    saveData(true);
  }

  // Clear stored display ID and go back to pairing
  localStorage.removeItem(STORAGE_KEY);
  displayId = null;
  tableData = {
    headers: [],
    rows: [],
    displaySettings: { startRow: 0, rowCount: 10 }
  };
  sortState = { column: null, direction: null };

  clearCode();
  elements.pairingError.classList.add('hidden');
  showScreen('pairing');
}

// ===================
// Initialization
// ===================

async function init() {
  // Setup event listeners
  setupPairingInputs();

  elements.connectBtn.addEventListener('click', handleConnect);
  elements.backBtn.addEventListener('click', handleBack);
  elements.saveBtn.addEventListener('click', () => saveData(true));

  elements.addRowBtn.addEventListener('click', addRow);
  elements.addColumnBtn.addEventListener('click', addColumn);

  // Cell modal
  elements.modalClose.addEventListener('click', closeCellModal);
  elements.modalCancel.addEventListener('click', closeCellModal);
  elements.modalSave.addEventListener('click', saveCellEdit);

  // Allow Enter in cell input to save
  elements.cellInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveCellEdit();
    }
    if (e.key === 'Escape') {
      closeCellModal();
    }
  });

  // Delete modal
  elements.deleteCancel.addEventListener('click', closeDeleteModal);
  elements.deleteConfirm.addEventListener('click', executeDelete);

  // TV settings
  elements.startRowInput.addEventListener('change', updateDisplaySettings);
  elements.rowCountInput.addEventListener('change', updateDisplaySettings);

  // Close modals on backdrop click
  elements.cellModal.addEventListener('click', (e) => {
    if (e.target === elements.cellModal) {
      closeCellModal();
    }
  });

  elements.deleteModal.addEventListener('click', (e) => {
    if (e.target === elements.deleteModal) {
      closeDeleteModal();
    }
  });

  // Header click for sorting (using event delegation)
  elements.editorHead.addEventListener('dblclick', (e) => {
    const th = e.target.closest('th[data-col]');
    if (th && !e.target.classList.contains('delete-col')) {
      const colIndex = parseInt(th.dataset.col, 10);
      toggleSort(colIndex);
    }
  });

  // Check for existing session
  const storedId = localStorage.getItem(STORAGE_KEY);

  if (storedId) {
    displayId = storedId;
    showScreen('loading');

    try {
      // Verify display exists
      const response = await fetch(`/api/displays/${storedId}`);

      if (response.ok) {
        await loadDisplayData();
        showScreen('editor');
        return;
      }
    } catch (error) {
      console.error('Session restore error:', error);
    }

    // Clear invalid session
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
  // Prevent default browser prompt
  e.preventDefault();
  deferredPrompt = e;

  // Show custom install banner
  const banner = document.getElementById('install-banner');
  if (banner) {
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

    // Show browser install prompt
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install prompt outcome:', outcome);

    // Clear prompt reference
    deferredPrompt = null;
    banner.classList.add('hidden');
  });

  dismissBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
    // Store dismissal preference
    localStorage.setItem('horseboard_install_dismissed', 'true');
  });

  // Check if already dismissed
  if (localStorage.getItem('horseboard_install_dismissed')) {
    banner.classList.add('hidden');
  }
}

// Handle app installed event
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
