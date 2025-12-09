/**
 * Display service - business logic layer
 */
export class DisplayService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new display session
   */
  createDisplay() {
    return this.db.createDisplay();
  }

  /**
   * Get display by ID
   */
  getDisplay(id) {
    return this.db.getDisplayById(id);
  }

  /**
   * Pair a controller with a display using pair code
   */
  pairWithCode(code) {
    const display = this.db.getDisplayByPairCode(code);
    if (!display) {
      return { success: false, error: 'Invalid pairing code' };
    }
    return { success: true, displayId: display.id };
  }

  /**
   * Update display table data
   */
  updateDisplay(id, tableData) {
    // Validate tableData structure
    if (!this.isValidTableData(tableData)) {
      return { success: false, error: 'Invalid table data format' };
    }

    const success = this.db.updateDisplayData(id, tableData);
    if (!success) {
      return { success: false, error: 'Display not found' };
    }

    return { success: true, updatedAt: new Date().toISOString() };
  }

  /**
   * Delete a display
   */
  deleteDisplay(id) {
    return this.db.deleteDisplay(id);
  }

  /**
   * Validate table data structure
   */
  isValidTableData(data) {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    // Headers must be an array (can be empty)
    if (!Array.isArray(data.headers)) {
      return false;
    }

    // Rows must be an array (can be empty)
    if (!Array.isArray(data.rows)) {
      return false;
    }

    // Each row must be an array
    for (const row of data.rows) {
      if (!Array.isArray(row)) {
        return false;
      }
    }

    return true;
  }
}

export default DisplayService;
