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

    // Process the data before saving
    const processedData = this.processTableData(tableData);

    const success = this.db.updateDisplayData(id, processedData);
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
   * Process table data: calculate feed rankings and cleanup orphaned diet entries
   * Only processes domain format data, returns legacy format unchanged
   */
  processTableData(data) {
    // Only process domain format (has feeds/horses/diet)
    if (!data.feeds || !data.horses) {
      return data;
    }

    const processed = { ...data };

    // Calculate feed rankings based on usage
    processed.feeds = this.calculateFeedRankings(data.feeds, data.horses, data.diet);

    // Clean up orphaned diet entries
    processed.diet = this.cleanupOrphanedDiet(data.diet, data.feeds, data.horses);

    return processed;
  }

  /**
   * Calculate feed rankings based on usage count
   * Feeds used by more horses get lower rank (appear first)
   */
  calculateFeedRankings(feeds, horses, diet) {
    if (!feeds || feeds.length === 0) {
      return feeds || [];
    }

    // Count horses using each feed (where AM > 0 or PM > 0)
    const usageCounts = new Map();
    for (const feed of feeds) {
      usageCounts.set(feed.id, 0);
    }

    for (const horse of horses || []) {
      const horseDiet = diet?.[horse.id] || {};
      for (const feedId of Object.keys(horseDiet)) {
        const entry = horseDiet[feedId];
        if ((entry?.am && entry.am > 0) || (entry?.pm && entry.pm > 0)) {
          const current = usageCounts.get(feedId) || 0;
          usageCounts.set(feedId, current + 1);
        }
      }
    }

    // Sort feeds by usage count (descending) and assign ranks
    const sortedFeeds = [...feeds].sort((a, b) => {
      const countA = usageCounts.get(a.id) || 0;
      const countB = usageCounts.get(b.id) || 0;
      return countB - countA;
    });

    return sortedFeeds.map((feed, index) => ({
      ...feed,
      rank: index + 1
    }));
  }

  /**
   * Remove diet entries for feeds or horses that no longer exist
   */
  cleanupOrphanedDiet(diet, feeds, horses) {
    if (!diet || !feeds || !horses) {
      return {};
    }

    const feedIds = new Set(feeds.map(f => f.id));
    const horseIds = new Set(horses.map(h => h.id));
    const cleaned = {};

    for (const horseId of Object.keys(diet)) {
      // Skip if horse no longer exists
      if (!horseIds.has(horseId)) {
        continue;
      }

      const horseDiet = diet[horseId];
      const cleanedHorseDiet = {};

      for (const feedId of Object.keys(horseDiet)) {
        // Only keep if feed still exists
        if (feedIds.has(feedId)) {
          cleanedHorseDiet[feedId] = horseDiet[feedId];
        }
      }

      // Only include horse if they have any diet entries
      if (Object.keys(cleanedHorseDiet).length > 0) {
        cleaned[horseId] = cleanedHorseDiet;
      }
    }

    return cleaned;
  }

  /**
   * Validate table data structure - supports domain structure
   */
  isValidTableData(data) {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    // Check for domain structure (new format)
    if ('settings' in data || 'feeds' in data || 'horses' in data || 'diet' in data) {
      return this.isValidDomainData(data);
    }

    // Legacy format: headers and rows arrays
    if (!Array.isArray(data.headers)) {
      return false;
    }

    if (!Array.isArray(data.rows)) {
      return false;
    }

    for (const row of data.rows) {
      if (!Array.isArray(row)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate domain data structure
   */
  isValidDomainData(data) {
    // Settings validation
    if (!data.settings || typeof data.settings !== 'object') {
      return false;
    }

    const { settings } = data;
    if (typeof settings.timezone !== 'string') {
      return false;
    }
    if (!['AUTO', 'AM', 'PM'].includes(settings.timeMode)) {
      return false;
    }
    if (typeof settings.zoomLevel !== 'number' || settings.zoomLevel < 1 || settings.zoomLevel > 3) {
      return false;
    }
    if (typeof settings.currentPage !== 'number' || settings.currentPage < 0) {
      return false;
    }

    // Feeds validation
    if (!Array.isArray(data.feeds)) {
      return false;
    }
    for (const feed of data.feeds) {
      if (!this.isValidFeed(feed)) {
        return false;
      }
    }

    // Horses validation
    if (!Array.isArray(data.horses)) {
      return false;
    }
    for (const horse of data.horses) {
      if (!this.isValidHorse(horse)) {
        return false;
      }
    }

    // Diet validation
    if (typeof data.diet !== 'object' || data.diet === null) {
      return false;
    }
    if (!this.isValidDiet(data.diet)) {
      return false;
    }

    return true;
  }

  /**
   * Validate a feed object
   */
  isValidFeed(feed) {
    if (typeof feed !== 'object' || feed === null) {
      return false;
    }
    if (typeof feed.id !== 'string' || feed.id.length === 0) {
      return false;
    }
    if (typeof feed.name !== 'string' || feed.name.length === 0) {
      return false;
    }
    if (typeof feed.unit !== 'string' || feed.unit.length === 0) {
      return false;
    }
    // Rank is optional (will be calculated server-side)
    if (feed.rank !== undefined && typeof feed.rank !== 'number') {
      return false;
    }
    return true;
  }

  /**
   * Validate a horse object
   */
  isValidHorse(horse) {
    if (typeof horse !== 'object' || horse === null) {
      return false;
    }
    if (typeof horse.id !== 'string' || horse.id.length === 0) {
      return false;
    }
    if (typeof horse.name !== 'string' || horse.name.length === 0) {
      return false;
    }
    // Note is optional
    if (horse.note !== undefined && horse.note !== null && typeof horse.note !== 'string') {
      return false;
    }
    // Note expiry is optional (unix timestamp or null)
    if (horse.noteExpiry !== undefined && horse.noteExpiry !== null && typeof horse.noteExpiry !== 'number') {
      return false;
    }
    // Note created at is optional
    if (horse.noteCreatedAt !== undefined && horse.noteCreatedAt !== null && typeof horse.noteCreatedAt !== 'number') {
      return false;
    }
    return true;
  }

  /**
   * Validate diet structure
   */
  isValidDiet(diet) {
    for (const horseId of Object.keys(diet)) {
      const horseDiet = diet[horseId];
      if (typeof horseDiet !== 'object' || horseDiet === null) {
        return false;
      }
      for (const feedId of Object.keys(horseDiet)) {
        const entry = horseDiet[feedId];
        if (typeof entry !== 'object' || entry === null) {
          return false;
        }
        // AM and PM must be numbers or null/undefined
        if (entry.am !== undefined && entry.am !== null && typeof entry.am !== 'number') {
          return false;
        }
        if (entry.pm !== undefined && entry.pm !== null && typeof entry.pm !== 'number') {
          return false;
        }
      }
    }
    return true;
  }
}

export default DisplayService;
