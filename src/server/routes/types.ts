import type Database from 'better-sqlite3';
import type {
  HorsesRepository,
  FeedsRepository,
  DietRepository,
  BoardsRepository,
  ControllerTokensRepository,
  InviteCodesRepository,
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
    controllerTokens: ControllerTokensRepository;
    inviteCodes: InviteCodesRepository;
  };
  broadcast: (boardId: string) => void;
  rankingManager: FeedRankingManager;
  expiryScheduler: ExpiryScheduler;
  provisioningStore: Map<string, {
    code: string;
    board_id?: string;
    timestamp: number;
    token?: string;
  }>;
}
