/**
 * Time Mode Service
 * Handles AM/PM detection, override expiry, and state broadcasts
 */
export class TimeModeService {
  constructor(displayService, sseManager) {
    this.displayService = displayService;
    this.sseManager = sseManager;
  }

  /**
   * Check a single display for override expiry
   */
  checkDisplayForExpiry(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) return false;

    const { settings } = display.tableData;
    if (!settings) return false;

    const now = Date.now();

    if (settings.overrideUntil && settings.overrideUntil < now) {
      // Reset to AUTO via direct database update
      this.displayService.db.updateSettings(displayId, {
        timeMode: 'AUTO',
        overrideUntil: null,
      });

      // Broadcast state change
      this.broadcastStateChange(displayId);
      return true;
    }

    return false;
  }

  /**
   * Broadcast a state change
   */
  broadcastStateChange(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) return;

    this.sseManager.broadcast(displayId, {
      tableData: display.tableData,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Calculate effective time mode based on timezone
   * AUTO: 04:00-11:59 = AM, 12:00-03:59 = PM
   */
  getEffectiveTimeMode(timezone, date = new Date()) {
    try {
      const hour = parseInt(
        date.toLocaleString('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: false,
        })
      );
      return hour >= 4 && hour < 12 ? 'AM' : 'PM';
    } catch {
      return date.getUTCHours() >= 4 && date.getUTCHours() < 12 ? 'AM' : 'PM';
    }
  }

  /**
   * Set override mode (schedules 1-hour expiry)
   */
  setOverride(displayId, mode) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    if (!['AM', 'PM'].includes(mode)) {
      return { success: false, error: 'Invalid mode' };
    }

    const expiryTime = Date.now() + 60 * 60 * 1000; // 1 hour

    this.displayService.db.updateSettings(displayId, {
      timeMode: mode,
      overrideUntil: expiryTime,
    });

    this.broadcastStateChange(displayId);

    return {
      success: true,
      overrideUntil: expiryTime,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clear override and return to AUTO mode
   */
  clearOverride(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    this.displayService.db.updateSettings(displayId, {
      timeMode: 'AUTO',
      overrideUntil: null,
    });

    this.broadcastStateChange(displayId);

    return {
      success: true,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get the current display mode (resolves AUTO to AM/PM)
   */
  getCurrentMode(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    const { settings } = display.tableData;
    if (!settings) {
      return { success: false, error: 'No settings found' };
    }

    const now = Date.now();

    // Check for expired override
    if (settings.overrideUntil && settings.overrideUntil < now) {
      return {
        success: true,
        mode: 'AUTO',
        effectiveMode: this.getEffectiveTimeMode(settings.timezone),
        overrideExpired: true,
      };
    }

    if (settings.timeMode === 'AUTO') {
      return {
        success: true,
        mode: 'AUTO',
        effectiveMode: this.getEffectiveTimeMode(settings.timezone),
        overrideUntil: null,
      };
    }

    return {
      success: true,
      mode: settings.timeMode,
      effectiveMode: settings.timeMode,
      overrideUntil: settings.overrideUntil,
    };
  }
}

export default TimeModeService;
