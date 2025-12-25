import { generateId } from '../index.js';

/**
 * Feed repository for CRUD operations
 */
export class FeedRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      getById: this.db.prepare(`
        SELECT id, display_id, name, unit, rank, stock_level, low_stock_threshold,
               created_at, updated_at
        FROM feeds WHERE id = ?
      `),
      getByDisplayId: this.db.prepare(`
        SELECT id, display_id, name, unit, rank, stock_level, low_stock_threshold,
               created_at, updated_at
        FROM feeds WHERE display_id = ?
        ORDER BY rank DESC, name
      `),
      getByName: this.db.prepare(`
        SELECT id FROM feeds WHERE display_id = ? AND name = ?
      `),
      create: this.db.prepare(`
        INSERT INTO feeds (id, display_id, name, unit)
        VALUES (?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE feeds
        SET name = COALESCE(?, name),
            unit = COALESCE(?, unit),
            stock_level = COALESCE(?, stock_level),
            low_stock_threshold = COALESCE(?, low_stock_threshold)
        WHERE id = ?
      `),
      updateRank: this.db.prepare(`
        UPDATE feeds SET rank = ? WHERE id = ?
      `),
      delete: this.db.prepare('DELETE FROM feeds WHERE id = ?'),
      // Calculate feed rankings based on usage
      calculateRankings: this.db.prepare(`
        SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count
        FROM feeds f
        LEFT JOIN diet_entries d ON f.id = d.feed_id
          AND (d.am_amount > 0 OR d.pm_amount > 0)
        WHERE f.display_id = ?
        GROUP BY f.id
        ORDER BY usage_count DESC
      `),
    };
  }

  /**
   * Transform database row to API response format
   */
  toApiFormat(row) {
    if (!row) return null;
    return {
      id: row.id,
      displayId: row.display_id,
      name: row.name,
      unit: row.unit,
      rank: row.rank,
      stockLevel: row.stock_level,
      lowStockThreshold: row.low_stock_threshold,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getById(id) {
    return this.toApiFormat(this.stmts.getById.get(id));
  }

  getByDisplayId(displayId) {
    return this.stmts.getByDisplayId.all(displayId).map((row) => this.toApiFormat(row));
  }

  exists(displayId, name) {
    return !!this.stmts.getByName.get(displayId, name);
  }

  create(displayId, name, unit = 'scoop') {
    if (this.exists(displayId, name)) {
      throw new Error(`Feed "${name}" already exists`);
    }
    const id = generateId('f');
    this.stmts.create.run(id, displayId, name, unit);
    return this.getById(id);
  }

  update(id, updates) {
    const result = this.stmts.update.run(
      updates.name ?? null,
      updates.unit ?? null,
      updates.stockLevel ?? null,
      updates.lowStockThreshold ?? null,
      id
    );
    return result.changes > 0 ? this.getById(id) : null;
  }

  delete(id) {
    const result = this.stmts.delete.run(id);
    return result.changes > 0;
  }

  /**
   * Recalculate feed rankings based on usage count
   * Most commonly used feeds get higher rank
   */
  recalculateRankings(displayId) {
    const rankings = this.stmts.calculateRankings.all(displayId);
    for (let i = 0; i < rankings.length; i++) {
      // Higher usage = higher rank (descending from count)
      this.stmts.updateRank.run(rankings.length - i, rankings[i].id);
    }
    return rankings.length;
  }
}

export default FeedRepository;
