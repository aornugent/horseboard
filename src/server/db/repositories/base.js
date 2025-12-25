/**
 * Base Repository
 *
 * Common functionality for all entity repositories.
 * Handles field mapping, statement preparation, and CRUD boilerplate.
 */

import { generateId } from '../index.js';

/** Convert camelCase to snake_case */
const toSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Convert snake_case to camelCase */
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Base repository class that handles common patterns.
 */
export class BaseRepository {
  /**
   * @param {Database} db - better-sqlite3 database instance
   * @param {object} config - Repository configuration
   * @param {string} config.table - SQL table name
   * @param {string} config.idPrefix - Prefix for generated IDs
   * @param {string[]} config.fields - List of camelCase field names (excluding id, timestamps)
   * @param {string} [config.parentField] - Parent foreign key field (camelCase)
   * @param {string} [config.uniqueField] - Field that must be unique within parent
   * @param {string} [config.orderBy] - ORDER BY clause
   * @param {object} [config.booleanFields] - Fields that should be converted to boolean
   */
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.table = config.table;
    this.idPrefix = config.idPrefix;
    this.fields = config.fields;
    this.parentField = config.parentField;
    this.uniqueField = config.uniqueField;
    this.orderBy = config.orderBy || '';
    this.booleanFields = new Set(config.booleanFields || []);

    // Build SQL column list
    const allFields = ['id'];
    if (this.parentField) allFields.push(this.parentField);
    allFields.push(...this.fields, 'createdAt', 'updatedAt');
    this.sqlColumns = allFields.map(toSnake).join(', ');

    this.prepareStatements();
  }

  prepareStatements() {
    const { table, sqlColumns, parentField, uniqueField, orderBy } = this;
    const parentCol = parentField ? toSnake(parentField) : null;
    const uniqueCol = uniqueField ? toSnake(uniqueField) : null;

    this.stmts = {
      getById: this.db.prepare(`SELECT ${sqlColumns} FROM ${table} WHERE id = ?`),
      delete: this.db.prepare(`DELETE FROM ${table} WHERE id = ?`),
    };

    if (parentCol) {
      this.stmts.getByParent = this.db.prepare(
        `SELECT ${sqlColumns} FROM ${table} WHERE ${parentCol} = ? ${orderBy}`
      );
    }

    if (parentCol && uniqueCol) {
      this.stmts.checkUnique = this.db.prepare(
        `SELECT id FROM ${table} WHERE ${parentCol} = ? AND ${uniqueCol} = ?`
      );
    }
  }

  /** Transform DB row to API format */
  toApiFormat(row) {
    if (!row) return null;
    const result = {};
    for (const key of Object.keys(row)) {
      const camelKey = toCamel(key);
      let value = row[key];
      if (this.booleanFields.has(camelKey)) {
        value = Boolean(value);
      }
      result[camelKey] = value;
    }
    return result;
  }

  getById(id) {
    return this.toApiFormat(this.stmts.getById.get(id));
  }

  getByParent(parentId) {
    if (!this.stmts.getByParent) {
      throw new Error(`${this.table} has no parent relationship`);
    }
    return this.stmts.getByParent.all(parentId).map((r) => this.toApiFormat(r));
  }

  // Alias for backwards compatibility
  getByDisplayId(displayId) {
    return this.getByParent(displayId);
  }

  exists(parentId, uniqueValue) {
    if (!this.stmts.checkUnique) return false;
    return !!this.stmts.checkUnique.get(parentId, uniqueValue);
  }

  delete(id) {
    return this.stmts.delete.run(id).changes > 0;
  }

  /** Generate a new ID with the configured prefix */
  generateId() {
    return generateId(this.idPrefix);
  }
}

export default BaseRepository;
