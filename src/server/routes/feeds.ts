import { Router, Request, Response } from 'express';
import { CreateFeedSchema, UpdateFeedSchema } from '@shared/resources';
import { validate } from './middleware';
import { authenticate, requireEdit, getBoardPermission } from '../lib/auth';
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
  boardScoped.get('/', authenticate(), (req: Request, res: Response) => {
    const board = repos.boards.getById(req.params.boardId);
    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, board);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const items = repos.feeds.getByParent(req.params.boardId);
    res.json({ success: true, data: items });
  });

  // POST /api/boards/:boardId/feeds - create feed under board
  boardScoped.post('/', authenticate(), validate(CreateFeedSchema), (req: Request, res: Response) => {
    const board = repos.boards.getById(req.params.boardId);
    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, board);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (permission === 'view') {
      return res.status(403).json({ success: false, error: 'Edit permission required' });
    }

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
  boardScoped.post('/recalculate-rankings', authenticate(), (req: Request, res: Response) => {
    const board = repos.boards.getById(req.params.boardId);
    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, board);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (permission === 'view') {
      return res.status(403).json({ success: false, error: 'Edit permission required' });
    }

    const count = rankingManager.recalculateNow(req.params.boardId);
    broadcast(req.params.boardId);

    res.json({ success: true, data: { feedsRanked: count } });
  });

  // GET /api/feeds/:id - get feed by id
  standalone.get('/:id', authenticate(), (req: Request, res: Response) => {
    const item = repos.feeds.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }

    const board = repos.boards.getById(item.board_id);
    const permission = getBoardPermission(req, board);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: item });
  });

  // PATCH /api/feeds/:id - update feed
  standalone.patch('/:id', authenticate(), requireEdit, validate(UpdateFeedSchema), (req: Request, res: Response) => {
    const existing = repos.feeds.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }

    const board = repos.boards.getById(existing.board_id);
    const permission = getBoardPermission(req, board);
    if (permission === 'none' || permission === 'view') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const updated = repos.feeds.update(req.body, req.params.id);
    broadcast(existing.board_id);
    res.json({ success: true, data: updated });
  });

  // DELETE /api/feeds/:id - delete feed
  standalone.delete('/:id', authenticate(), requireEdit, (req: Request, res: Response) => {
    const existing = repos.feeds.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }

    const board = repos.boards.getById(existing.board_id);
    const permission = getBoardPermission(req, board);
    if (permission === 'none' || permission === 'view') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    repos.feeds.delete(req.params.id);
    rankingManager.scheduleRecalculation(existing.board_id);
    broadcast(existing.board_id);
    res.json({ success: true });
  });

  return { boardScoped, standalone };
}
