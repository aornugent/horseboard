/**
 * Feed Repository
 */

import { BaseRepository } from './base.js';

export class FeedRepository extends BaseRepository {
  constructor(db) {
    super(db, {
      table: 'feeds',
      idPrefix: 'f',
      fields: ['name', 'unit', 'rank', 'stockLevel', 'lowStockThreshold'],
      parentField: 'displayId',
      uniqueField: 'name',
      orderBy: 'ORDER BY rank DESC, name',
    });

    this.stmts.create = db.prepare(`INSERT INTO ${this.table} (id, display_id, name, unit) VALUES (?, ?, ?, ?)`);
    this.stmts.update = db.prepare(`
      UPDATE ${this.table} SET name = COALESCE(?, name), unit = COALESCE(?, unit),
        stock_level = COALESCE(?, stock_level), low_stock_threshold = COALESCE(?, low_stock_threshold)
      WHERE id = ?
    `);
    this.stmts.updateRank = db.prepare(`UPDATE ${this.table} SET rank = ? WHERE id = ?`);
    this.stmts.calculateRankings = db.prepare(`
      SELECT f.id, COUNT(DISTINCT d.horse_id) as usage_count FROM ${this.table} f
      LEFT JOIN diet_entries d ON f.id = d.feed_id AND (d.am_amount > 0 OR d.pm_amount > 0)
      WHERE f.display_id = ? GROUP BY f.id ORDER BY usage_count DESC
    `);
  }

  create(displayId, name, unit = 'scoop') {
    if (this.exists(displayId, name)) throw new Error(`Feed "${name}" already exists`);
    const id = this.generateId();
    this.stmts.create.run(id, displayId, name, unit);
    return this.getById(id);
  }

  update(id, updates) {
    const result = this.stmts.update.run(updates.name ?? null, updates.unit ?? null,
      updates.stockLevel ?? null, updates.lowStockThreshold ?? null, id);
    return result.changes > 0 ? this.getById(id) : null;
  }

  recalculateRankings(displayId) {
    const rankings = this.stmts.calculateRankings.all(displayId);
    for (let i = 0; i < rankings.length; i++) {
      this.stmts.updateRank.run(rankings.length - i, rankings[i].id);
    }
    return rankings.length;
  }
}

export default FeedRepository;
