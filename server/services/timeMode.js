/**
 * Time Mode Service
 * Handles AM/PM detection, override expiry, and state broadcasts
 */
export class TimeModeService {
  constructor(displayService, sseManager) {
    this.displayService = displayService;
    this.sseManager = sseManager;
    this.checkInterval = null;
  }

  /**
   * Start the interval check for override expiry (every minute)
   */
  startOverrideExpiryCheck() {
    // Check every minute
    this.checkInterval = setInterval(() => {
      this.checkAllDisplaysForExpiry();
    }, 60000);
  }

  /**
   * Stop the interval check
   */
  stopOverrideExpiryCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check all displays for override expiry
   * @param {Function} getDisplayIds - Function to get all display IDs
   */
  async checkAllDisplaysForExpiry(getDisplayIds) {
    if (!getDisplayIds) return;

    const displayIds = getDisplayIds();
    const now = Date.now();

    for (const displayId of displayIds) {
      const display = this.displayService.getDisplay(displayId);
      if (!display) continue;

      const { settings } = display.tableData;
      if (!settings) continue;

      // Check if override has expired
      if (settings.overrideUntil && settings.overrideUntil < now) {
        // Reset to AUTO
        const updatedSettings = {
          ...settings,
          timeMode: 'AUTO',
          overrideUntil: null
        };

        const updatedTableData = {
          ...display.tableData,
          settings: updatedSettings
        };

        // Update in database
        this.displayService.db.updateDisplayData(displayId, updatedTableData);

        // Broadcast state change
        this.broadcastStateChange(displayId, updatedSettings);
      }
    }
  }

  /**
   * Check a single display for override expiry
   * @returns {boolean} true if override was expired and reset
   */
  checkDisplayForExpiry(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) return false;

    const { settings } = display.tableData;
    if (!settings) return false;

    const now = Date.now();

    if (settings.overrideUntil && settings.overrideUntil < now) {
      // Reset to AUTO
      const updatedSettings = {
        ...settings,
        timeMode: 'AUTO',
        overrideUntil: null
      };

      const updatedTableData = {
        ...display.tableData,
        settings: updatedSettings
      };

      // Update in database
      this.displayService.db.updateDisplayData(displayId, updatedTableData);

      // Broadcast state change
      this.broadcastStateChange(displayId, updatedSettings);

      return true;
    }

    return false;
  }

  /**
   * Broadcast a state change (lightweight update)
   */
  broadcastStateChange(displayId, settings) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) return;

    this.sseManager.broadcast(displayId, {
      tableData: display.tableData,
      updatedAt: new Date().toISOString(),
      stateChange: true
    });
  }

  /**
   * Calculate the effective time mode (AM or PM) based on timezone
   * AUTO: 04:00-11:59 = AM, 12:00-03:59 = PM
   * @param {string} timezone - IANA timezone (e.g., "Australia/Sydney")
   * @param {Date} date - Optional date to use for calculation (default: now)
   * @returns {'AM'|'PM'} The effective time mode
   */
  getEffectiveTimeMode(timezone, date = new Date()) {
    const hour = this.getHourInTimezone(timezone, date);

    // 04:00-11:59 = AM, 12:00-03:59 = PM
    if (hour >= 4 && hour < 12) {
      return 'AM';
    }
    return 'PM';
  }

  /**
   * Get the current hour in a specific timezone
   * @param {string} timezone - IANA timezone
   * @param {Date} date - Optional date to use
   * @returns {number} Hour (0-23)
   */
  getHourInTimezone(timezone, date = new Date()) {
    try {
      const options = {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(date);
      const hourPart = parts.find(p => p.type === 'hour');
      return parseInt(hourPart?.value || '0', 10);
    } catch (err) {
      // Fallback to UTC if timezone is invalid
      return date.getUTCHours();
    }
  }

  /**
   * Set override mode and schedule expiry
   * @param {string} displayId - Display ID
   * @param {'AM'|'PM'} mode - The mode to set
   * @returns {Object} Result with success status
   */
  setOverride(displayId, mode) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    if (!['AM', 'PM'].includes(mode)) {
      return { success: false, error: 'Invalid mode' };
    }

    const now = Date.now();
    const expiryTime = now + (60 * 60 * 1000); // 1 hour from now

    const updatedSettings = {
      ...display.tableData.settings,
      timeMode: mode,
      overrideUntil: expiryTime
    };

    const updatedTableData = {
      ...display.tableData,
      settings: updatedSettings
    };

    // Update in database
    this.displayService.db.updateDisplayData(displayId, updatedTableData);

    // Broadcast state change
    this.broadcastStateChange(displayId, updatedSettings);

    return {
      success: true,
      overrideUntil: expiryTime,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Clear override and return to AUTO mode
   * @param {string} displayId - Display ID
   * @returns {Object} Result with success status
   */
  clearOverride(displayId) {
    const display = this.displayService.getDisplay(displayId);
    if (!display) {
      return { success: false, error: 'Display not found' };
    }

    const updatedSettings = {
      ...display.tableData.settings,
      timeMode: 'AUTO',
      overrideUntil: null
    };

    const updatedTableData = {
      ...display.tableData,
      settings: updatedSettings
    };

    // Update in database
    this.displayService.db.updateDisplayData(displayId, updatedTableData);

    // Broadcast state change
    this.broadcastStateChange(displayId, updatedSettings);

    return {
      success: true,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get the current display mode (resolves AUTO to AM/PM)
   * @param {string} displayId - Display ID
   * @returns {Object} The resolved mode info
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

    // Check for expired override
    const now = Date.now();
    if (settings.overrideUntil && settings.overrideUntil < now) {
      // Override expired, treat as AUTO
      return {
        success: true,
        mode: 'AUTO',
        effectiveMode: this.getEffectiveTimeMode(settings.timezone),
        overrideExpired: true
      };
    }

    if (settings.timeMode === 'AUTO') {
      return {
        success: true,
        mode: 'AUTO',
        effectiveMode: this.getEffectiveTimeMode(settings.timezone),
        overrideUntil: null
      };
    }

    return {
      success: true,
      mode: settings.timeMode,
      effectiveMode: settings.timeMode,
      overrideUntil: settings.overrideUntil
    };
  }
}

export default TimeModeService;
