import type Database from 'better-sqlite3';
import type { Repository } from '../lib/engine';
import type { FeedRankingManager } from '../lib/rankings';
import type { ExpiryScheduler } from '../scheduler';

/**
 * Route context - dependencies injected into route handlers
 */
export interface RouteContext {
  db: Database.Database;
  repos: {
    boards: Repository<'boards'>;
    horses: Repository<'horses'>;
    feeds: Repository<'feeds'>;
    diet: Repository<'diet'>;
  };
  broadcast: (boardId: string) => void;
  rankingManager: FeedRankingManager;
  expiryScheduler: ExpiryScheduler;
}
