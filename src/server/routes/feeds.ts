import { Router, Request, Response } from 'express';
import { CreateFeedSchema, UpdateFeedSchema } from '@shared/resources';
import { validate } from './middleware';
import { requirePermission } from '../lib/auth';
import type { RouteContext } from './types';

/**
 * Create feeds router with explicit REST endpoints
 *
 * Endpoints:
 * - GET /api/boards/:boardId/feeds - list feeds for a board
 * - POST /api/boards/:boardId/feeds - create feed under board
 * - POST /api/boards/:boardId/feeds/recalculate-rankings - recalculate rankings
 * - GET /api/feeds/:id - get feed by id
 * - PATCH /api/feeds/:id - update feed
 * - DELETE /api/feeds/:id - delete feed
 */
export function createFeedsRouter(ctx: RouteContext): { boardScoped: Router; standalone: Router } {
  const boardScoped = Router({ mergeParams: true });
  const standalone = Router();
  const { repos, broadcast, rankingManager } = ctx;

  // GET /api/boards/:boardId/feeds - list feeds for a board
  boardScoped.get('/', requirePermission('view'), (req: Request, res: Response) => {
    const items = repos.feeds.getByParent(req.params.boardId);
    res.json({ success: true, data: items });
  });

  // POST /api/boards/:boardId/feeds - create feed under board
  boardScoped.post('/', requirePermission('edit'), validate(CreateFeedSchema), (req: Request, res: Response) => {
    try {
      const item = repos.feeds.create(req.body, req.params.boardId);
      rankingManager.scheduleRecalculation(req.params.boardId);
      broadcast(req.params.boardId);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('UNIQUE constraint')) {
        res.status(409).json({ success: false, error: 'Already exists' });
        return;
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/boards/:boardId/feeds/recalculate-rankings - recalculate rankings
  boardScoped.post('/recalculate-rankings', requirePermission('edit'), (req: Request, res: Response) => {
    const board = repos.boards.getById(req.params.boardId);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    const count = rankingManager.recalculateNow(req.params.boardId);
    broadcast(req.params.boardId);

    res.json({ success: true, data: { feedsRanked: count } });
  });

  // GET /api/feeds/:id - get feed by id
  standalone.get('/:id', requirePermission('view', async (req, repos) => {
    const item = repos.feeds.getById(req.params.id);
    return item?.board_id;
  }), (req: Request, res: Response) => {
    const item = repos.feeds.getById(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Feed not found' });
      return;
    }
    res.json({ success: true, data: item });
  });

  // PATCH /api/feeds/:id - update feed
  standalone.patch('/:id', requirePermission('edit', async (req, repos) => {
    const item = repos.feeds.getById(req.params.id);
    return item?.board_id;
  }), validate(UpdateFeedSchema), (req: Request, res: Response) => {
    const existing = repos.feeds.getById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Feed not found' });
      return;
    }

    const updated = repos.feeds.update(req.body, req.params.id);
    broadcast(existing.board_id);
    res.json({ success: true, data: updated });
  });

  // DELETE /api/feeds/:id - delete feed
  standalone.delete('/:id', requirePermission('edit', async (req, repos) => {
    const item = repos.feeds.getById(req.params.id);
    return item?.board_id;
  }), (req: Request, res: Response) => {
    const existing = repos.feeds.getById(req.params.id);
    const deleted = repos.feeds.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Feed not found' });
      return;
    }
    if (existing) {
      rankingManager.scheduleRecalculation(existing.board_id);
      broadcast(existing.board_id);
    }
    res.json({ success: true });
  });

  return { boardScoped, standalone };
}
