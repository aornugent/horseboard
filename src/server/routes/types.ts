import type Database from 'better-sqlite3';
import type {
  HorsesRepository,
  FeedsRepository,
  DietRepository,
  BoardsRepository,
} from '../lib/engine';
import type { FeedRankingManager } from '../lib/rankings';
import type { ExpiryScheduler } from '../scheduler';

export interface RouteContext {
  db: Database.Database;
  repos: {
    boards: BoardsRepository;
    horses: HorsesRepository;
    feeds: FeedsRepository;
    diet: DietRepository;
  };
  broadcast: (boardId: string) => void;
  rankingManager: FeedRankingManager;
  expiryScheduler: ExpiryScheduler;
}
