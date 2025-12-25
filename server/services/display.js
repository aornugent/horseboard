/**
 * Display service - thin wrapper over database
 *
 * Most logic now lives in:
 * - Database layer (server/db/sqlite.js) - relational sync, rankings
 * - Shared resources (shared/resources.js) - schemas, validation
 */
export class DisplayService {
  constructor(db) {
    this.db = db;
  }

  createDisplay() {
    return this.db.createDisplay();
  }

  getDisplay(id) {
    return this.db.getDisplayById(id);
  }

  pairWithCode(code) {
    const display = this.db.getDisplayByPairCode(code);
    if (!display) {
      return { success: false, error: 'Invalid pairing code' };
    }
    return { success: true, displayId: display.id };
  }

  updateDisplay(id, tableData) {
    // Basic validation - detailed validation happens in DB layer via Zod schemas
    if (!tableData || typeof tableData !== 'object') {
      return { success: false, error: 'Invalid table data format' };
    }

    const success = this.db.updateDisplayData(id, tableData);
    if (!success) {
      return { success: false, error: 'Display not found' };
    }

    return { success: true, updatedAt: new Date().toISOString() };
  }

  deleteDisplay(id) {
    return this.db.deleteDisplay(id);
  }
}

export default DisplayService;
