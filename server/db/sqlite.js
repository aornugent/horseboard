import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { RESOURCES, DISPLAY_TABLE } from '../../shared/resources.js';

/**
 * Database wrapper for SQLite operations
 * Uses relational schema (3NF) for horses, feeds, and diet entries
 */
export class DisplayDatabase {
  constructor(dbPath = './data/horseboard.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Initialize database schema from resource definitions
   */
  initialize() {
    // Create displays table first (referenced by others)
    const displayCols = Object.entries(DISPLAY_TABLE.columns)
      .map(([name, def]) => `${name} ${def}`)
      .join(',\n        ');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS displays (
        ${displayCols}
      )
    `);

    // Create resource tables
    for (const [name, config] of Object.entries(RESOURCES)) {
      const cols = Object.entries(config.columns)
        .map(([colName, def]) => `${colName} ${def}`)
        .join(',\n        ');

      const constraints = config.constraints
        ? ',\n        ' + config.constraints.join(',\n        ')
        : '';

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${config.table} (
          ${cols}${constraints}
        )
      `);

      // Create indexes
      if (config.indexes) {
        for (const index of config.indexes) {
          this.db.exec(index);
        }
      }
    }

    // Create trigger for updated_at timestamps
    for (const [name, config] of Object.entries(RESOURCES)) {
      const triggerName = `update_${config.table}_timestamp`;
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS ${triggerName}
        AFTER UPDATE ON ${config.table}
        BEGIN
          UPDATE ${config.table} SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
        END
      `);
    }

    // Display table trigger
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_displays_timestamp
      AFTER UPDATE ON displays
      BEGIN
        UPDATE displays SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
      END
    `);

    return this;
  }

  /**
   * Generate a unique display ID
   */
  generateId(prefix = 'd') {
    return prefix + '_' + randomBytes(8).toString('hex');
  }

  /**
   * Generate a unique 6-digit pairing code
   */
  generatePairCode() {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = this.db.prepare('SELECT 1 FROM displays WHERE pair_code = ?').get(code);
    if (existing) {
      return this.generatePairCode();
    }
    return code;
  }

  /**
   * Create a new display
   */
  createDisplay(timezone = 'Australia/Sydney') {
    const id = this.generateId('d');
    const pairCode = this.generatePairCode();

    this.db.prepare(`
      INSERT INTO displays (id, pair_code, timezone, time_mode, zoom_level, current_page)
      VALUES (?, ?, ?, 'AUTO', 2, 0)
    `).run(id, pairCode, timezone);

    return { id, pairCode };
  }

  /**
   * Get display by ID (returns full state for compatibility)
   */
  getDisplayById(id) {
    const display = this.db.prepare(`
      SELECT id, pair_code, timezone, time_mode, override_until,
             zoom_level, current_page, created_at, updated_at
      FROM displays WHERE id = ?
    `).get(id);

    if (!display) return null;

    // Build tableData in the format the client expects
    const horses = this.db.prepare('SELECT * FROM horses WHERE display_id = ?').all(id);
    const feeds = this.db.prepare('SELECT * FROM feeds WHERE display_id = ? ORDER BY rank ASC').all(id);

    // Get diet entries
    const horseIds = horses.map((h) => h.id);
    let dietEntries = [];
    if (horseIds.length > 0) {
      const placeholders = horseIds.map(() => '?').join(',');
      dietEntries = this.db.prepare(`SELECT * FROM diet_entries WHERE horse_id IN (${placeholders})`).all(...horseIds);
    }

    // Convert to nested diet format
    const diet = {};
    for (const entry of dietEntries) {
      if (!diet[entry.horse_id]) diet[entry.horse_id] = {};
      diet[entry.horse_id][entry.feed_id] = { am: entry.am, pm: entry.pm };
    }

    return {
      id: display.id,
      pairCode: display.pair_code,
      tableData: {
        settings: {
          timezone: display.timezone,
          timeMode: display.time_mode,
          overrideUntil: display.override_until,
          zoomLevel: display.zoom_level,
          currentPage: display.current_page,
        },
        horses: horses.map((h) => ({
          id: h.id,
          name: h.name,
          note: h.note,
          noteExpiry: h.note_expiry,
          noteCreatedAt: h.note_created_at,
        })),
        feeds: feeds.map((f) => ({
          id: f.id,
          name: f.name,
          unit: f.unit,
          rank: f.rank,
        })),
        diet,
      },
      createdAt: display.created_at,
      updatedAt: display.updated_at,
    };
  }

  /**
   * Get display by pairing code
   */
  getDisplayByPairCode(code) {
    const display = this.db.prepare('SELECT id FROM displays WHERE pair_code = ?').get(code);
    if (!display) return null;
    return this.getDisplayById(display.id);
  }

  /**
   * Update display table data (handles the transition from document to relational)
   */
  updateDisplayData(id, tableData) {
    // Check if display exists first
    const exists = this.db.prepare('SELECT 1 FROM displays WHERE id = ?').get(id);
    if (!exists) {
      return false;
    }

    const updateAll = this.db.transaction(() => {
      // Update settings
      if (tableData.settings) {
        this.db.prepare(`
          UPDATE displays
          SET timezone = ?, time_mode = ?, override_until = ?,
              zoom_level = ?, current_page = ?
          WHERE id = ?
        `).run(
          tableData.settings.timezone,
          tableData.settings.timeMode,
          tableData.settings.overrideUntil,
          tableData.settings.zoomLevel,
          tableData.settings.currentPage,
          id
        );
      }

      // Sync horses
      if (tableData.horses) {
        // Get existing horse IDs
        const existingHorses = new Set(
          this.db.prepare('SELECT id FROM horses WHERE display_id = ?').all(id).map((h) => h.id)
        );
        const newHorseIds = new Set(tableData.horses.map((h) => h.id));

        // Delete removed horses
        for (const horseId of existingHorses) {
          if (!newHorseIds.has(horseId)) {
            this.db.prepare('DELETE FROM horses WHERE id = ?').run(horseId);
          }
        }

        // Upsert horses
        const upsertHorse = this.db.prepare(`
          INSERT INTO horses (id, display_id, name, note, note_expiry, note_created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            note = excluded.note,
            note_expiry = excluded.note_expiry,
            note_created_at = excluded.note_created_at
        `);

        for (const horse of tableData.horses) {
          upsertHorse.run(
            horse.id,
            id,
            horse.name,
            horse.note || null,
            horse.noteExpiry || null,
            horse.noteCreatedAt || null
          );
        }
      }

      // Sync feeds
      if (tableData.feeds) {
        const existingFeeds = new Set(
          this.db.prepare('SELECT id FROM feeds WHERE display_id = ?').all(id).map((f) => f.id)
        );
        const newFeedIds = new Set(tableData.feeds.map((f) => f.id));

        // Delete removed feeds
        for (const feedId of existingFeeds) {
          if (!newFeedIds.has(feedId)) {
            this.db.prepare('DELETE FROM feeds WHERE id = ?').run(feedId);
          }
        }

        // Upsert feeds
        const upsertFeed = this.db.prepare(`
          INSERT INTO feeds (id, display_id, name, unit, rank)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            unit = excluded.unit,
            rank = excluded.rank
        `);

        for (const feed of tableData.feeds) {
          upsertFeed.run(feed.id, id, feed.name, feed.unit, feed.rank || 0);
        }
      }

      // Sync diet entries
      if (tableData.diet && tableData.horses) {
        // Build sets of valid horse and feed IDs
        const validHorseIds = new Set(tableData.horses.map((h) => h.id));
        const validFeedIds = new Set((tableData.feeds || []).map((f) => f.id));

        // Delete all existing diet entries for this display's horses
        const horseIds = tableData.horses.map((h) => h.id);
        if (horseIds.length > 0) {
          const placeholders = horseIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM diet_entries WHERE horse_id IN (${placeholders})`).run(...horseIds);
        }

        // Insert new diet entries (only for existing horses and feeds)
        const insertDiet = this.db.prepare(`
          INSERT INTO diet_entries (horse_id, feed_id, am, pm)
          VALUES (?, ?, ?, ?)
        `);

        for (const [horseId, horseDiet] of Object.entries(tableData.diet)) {
          // Skip if horse doesn't exist
          if (!validHorseIds.has(horseId)) continue;

          for (const [feedId, values] of Object.entries(horseDiet)) {
            // Skip if feed doesn't exist
            if (!validFeedIds.has(feedId)) continue;

            if (values.am !== null || values.pm !== null) {
              insertDiet.run(horseId, feedId, values.am, values.pm);
            }
          }
        }
      }

      // Recalculate feed rankings
      this.recalculateFeedRankings(id);
    });

    updateAll();
    return true;
  }

  /**
   * Recalculate feed rankings based on usage
   */
  recalculateFeedRankings(displayId) {
    const rankings = this.db.prepare(`
      SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count
      FROM feeds f
      LEFT JOIN diet_entries d ON f.id = d.feed_id
        AND (d.am > 0 OR d.pm > 0)
      WHERE f.display_id = ?
      GROUP BY f.id
      ORDER BY usage_count DESC, f.name ASC
    `).all(displayId);

    const updateRank = this.db.prepare('UPDATE feeds SET rank = ? WHERE id = ?');
    rankings.forEach((r, idx) => {
      updateRank.run(idx + 1, r.id);
    });
  }

  /**
   * Update display settings only
   */
  updateSettings(id, settings) {
    const result = this.db.prepare(`
      UPDATE displays
      SET timezone = COALESCE(?, timezone),
          time_mode = COALESCE(?, time_mode),
          override_until = ?,
          zoom_level = COALESCE(?, zoom_level),
          current_page = COALESCE(?, current_page)
      WHERE id = ?
    `).run(
      settings.timezone,
      settings.timeMode,
      settings.overrideUntil,
      settings.zoomLevel,
      settings.currentPage,
      id
    );
    return result.changes > 0;
  }

  /**
   * Delete a display and all its data (cascades via foreign keys)
   */
  deleteDisplay(id) {
    const result = this.db.prepare('DELETE FROM displays WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Clear expired time mode overrides
   */
  clearExpiredOverrides() {
    const expired = this.db.prepare(`
      SELECT id FROM displays
      WHERE time_mode != 'AUTO' AND override_until < ?
    `).all(Date.now());

    for (const { id } of expired) {
      this.db.prepare(`
        UPDATE displays SET time_mode = 'AUTO', override_until = NULL WHERE id = ?
      `).run(id);
    }

    return expired.map((r) => r.id);
  }

  /**
   * Clear expired horse notes
   */
  clearExpiredNotes() {
    const result = this.db.prepare(`
      UPDATE horses
      SET note = NULL, note_expiry = NULL, note_created_at = NULL
      WHERE note_expiry IS NOT NULL AND note_expiry < ?
    `).run(Date.now());

    return result.changes;
  }

  /**
   * Get raw db handle for advanced queries
   */
  get raw() {
    return this.db;
  }

  /**
   * Get all table names (for testing)
   */
  getTables() {
    return this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  }

  /**
   * Clear all displays (for testing)
   */
  clear() {
    this.db.exec('DELETE FROM displays');
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

export default DisplayDatabase;
