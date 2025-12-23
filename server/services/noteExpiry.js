/**
 * Note Expiry Service
 * Handles automatic clearing of expired horse notes
 */
export class NoteExpiryService {
  constructor(displayService, sseManager) {
    this.displayService = displayService;
    this.sseManager = sseManager;
  }

  /**
   * Check a display for expired notes and clear them
   * @param {string} displayId - Display ID to check
   * @returns {Object} Result with cleared notes info
   */
  checkAndClearExpiredNotes(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    const { tableData } = display;
    if (!tableData || !tableData.horses) {
      return { success: true, clearedCount: 0 };
    }

    const now = Date.now();
    let clearedCount = 0;
    let needsUpdate = false;

    const updatedHorses = tableData.horses.map(horse => {
      // Check if note has expired
      if (horse.noteExpiry && horse.noteExpiry < now) {
        clearedCount++;
        needsUpdate = true;
        return {
          ...horse,
          note: null,
          noteExpiry: null,
          noteCreatedAt: null
        };
      }
      return horse;
    });

    if (needsUpdate) {
      const updatedTableData = {
        ...tableData,
        horses: updatedHorses
      };

      // Update in database
      this.displayService.db.updateDisplayData(displayId, updatedTableData);

      // Broadcast the change
      const updatedDisplay = this.displayService.getDisplay(displayId);
      if (updatedDisplay) {
        this.sseManager.broadcast(displayId, {
          tableData: updatedDisplay.tableData,
          updatedAt: new Date().toISOString(),
          noteExpiry: true
        });
      }
    }

    return {
      success: true,
      clearedCount,
      updated: needsUpdate
    };
  }

  /**
   * Check all active displays for expired notes
   * @param {Function} getDisplayIds - Function to get display IDs to check
   */
  checkAllDisplaysForExpiredNotes(getDisplayIds) {
    if (!getDisplayIds) return;

    const displayIds = getDisplayIds();
    const results = [];

    for (const displayId of displayIds) {
      const result = this.checkAndClearExpiredNotes(displayId);
      if (result.clearedCount > 0) {
        results.push({ displayId, ...result });
      }
    }

    return results;
  }

  /**
   * Set a note with expiry on a horse
   * @param {string} displayId - Display ID
   * @param {string} horseId - Horse ID
   * @param {string} note - Note text
   * @param {number|null} expiryHours - Hours until expiry (null for no expiry)
   * @returns {Object} Result
   */
  setNote(displayId, horseId, note, expiryHours = null) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    const { tableData } = display;
    if (!tableData || !tableData.horses) {
      return { success: false, error: 'Invalid display data' };
    }

    const horseIndex = tableData.horses.findIndex(h => h.id === horseId);
    if (horseIndex === -1) {
      return { success: false, error: 'Horse not found' };
    }

    const now = Date.now();
    const noteExpiry = expiryHours ? now + (expiryHours * 60 * 60 * 1000) : null;

    const updatedHorses = [...tableData.horses];
    updatedHorses[horseIndex] = {
      ...updatedHorses[horseIndex],
      note: note || null,
      noteExpiry,
      noteCreatedAt: note ? now : null
    };

    const updatedTableData = {
      ...tableData,
      horses: updatedHorses
    };

    // Update in database
    this.displayService.db.updateDisplayData(displayId, updatedTableData);

    // Broadcast the change
    const updatedDisplay = this.displayService.getDisplay(displayId);
    if (updatedDisplay) {
      this.sseManager.broadcast(displayId, {
        tableData: updatedDisplay.tableData,
        updatedAt: new Date().toISOString()
      });
    }

    return {
      success: true,
      noteExpiry,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Clear a note from a horse
   * @param {string} displayId - Display ID
   * @param {string} horseId - Horse ID
   * @returns {Object} Result
   */
  clearNote(displayId, horseId) {
    return this.setNote(displayId, horseId, null, null);
  }

  /**
   * Get note status for a horse
   * @param {string} displayId - Display ID
   * @param {string} horseId - Horse ID
   * @returns {Object} Note status
   */
  getNoteStatus(displayId, horseId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    const horse = display.tableData.horses?.find(h => h.id === horseId);
    if (!horse) {
      return { success: false, error: 'Horse not found' };
    }

    const now = Date.now();
    const isExpired = !!(horse.noteExpiry && horse.noteExpiry < now);
    const isStale = !!(horse.noteCreatedAt &&
                    !horse.noteExpiry &&
                    (now - horse.noteCreatedAt) > (24 * 60 * 60 * 1000));

    return {
      success: true,
      note: horse.note,
      noteExpiry: horse.noteExpiry,
      noteCreatedAt: horse.noteCreatedAt,
      isExpired,
      isStale,
      expiresIn: horse.noteExpiry ? horse.noteExpiry - now : null
    };
  }
}

export default NoteExpiryService;
