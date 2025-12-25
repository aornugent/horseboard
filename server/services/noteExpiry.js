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
   * Uses the database's relational approach for efficient clearing
   */
  checkAndClearExpiredNotes(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    // Database now handles note expiry via horses table
    const clearedCount = this.displayService.db.clearExpiredNotes();

    if (clearedCount > 0) {
      // Broadcast the updated state
      const updatedDisplay = this.displayService.getDisplay(displayId);
      if (updatedDisplay) {
        this.sseManager.broadcast(displayId, {
          tableData: updatedDisplay.tableData,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return {
      success: true,
      clearedCount,
      updated: clearedCount > 0,
    };
  }
}

export default NoteExpiryService;
