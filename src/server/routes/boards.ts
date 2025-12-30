import { Router, Request, Response } from 'express';
import { UpdateBoardSchema, SetTimeModeSchema } from '@shared/resources';
import { validate } from './middleware';
import { requirePermission } from '../lib/auth';
import type { RouteContext } from './types';

/**
 * Create boards router with explicit REST endpoints
 *
 * Endpoints:
 * - GET /api/boards - list all boards
 * - GET /api/boards/:id - get board by id
 * - POST /api/boards - create new board
 * - PATCH /api/boards/:id - update board
 * - DELETE /api/boards/:id - delete board
 * - PUT /api/boards/:id/time-mode - update time mode with override
 * - GET /api/boards/:boardId/events - SSE endpoint
 */
export function createBoardsRouter(ctx: RouteContext): Router {
  const router = Router();
  const { repos, broadcast, expiryScheduler } = ctx;

  // GET /api/boards - list all boards
  router.get('/', requirePermission('view'), (_req: Request, res: Response) => {
    const items = repos.boards.getAll();
    res.json({ success: true, data: items });
  });

  // GET /api/boards/:id - get board by id
  router.get('/:id', requirePermission('view', req => req.params.id), (req: Request, res: Response) => {
    const item = repos.boards.getById(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }
    res.json({ success: true, data: item });
  });

  // POST /api/boards - create new board
  // We require 'view' permission (public/authenticated) to create a board
  router.post('/', requirePermission('view'), (req: Request, res: Response) => {
    try {
      const item = repos.boards.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/boards/:id/claim - claim an unclaimed board
  router.post('/:id/claim', requirePermission('view', req => req.params.id), (req: Request, res: Response) => {
    const { user_id } = req.authContext!; // Validated by requirePermission ('view' allows anon, so we check user_id)

    if (!user_id) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const board = repos.boards.getById(req.params.id);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    if (board.account_id) {
      res.status(409).json({ success: false, error: 'Board already has an owner' });
      return;
    }

    repos.boards.update({ account_id: user_id }, board.id);

    // Return updated board info with success
    res.json({
      success: true,
      data: {
        id: board.id,
        account_id: user_id,
        pair_code: board.pair_code
      }
    });
  });

  // PATCH /api/boards/:id - update board
  router.patch('/:id', requirePermission('edit', req => req.params.id), validate(UpdateBoardSchema), (req: Request, res: Response) => {
    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    const updated = repos.boards.update(req.body, req.params.id);
    broadcast(req.params.id);
    res.json({ success: true, data: updated });
  });

  // DELETE /api/boards/:id - delete board
  router.delete('/:id', requirePermission('admin', req => req.params.id), (req: Request, res: Response) => {
    const deleted = repos.boards.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }
    res.json({ success: true });
  });

  // PUT /api/boards/:id/time-mode - update time mode with override
  router.put('/:id/time-mode', requirePermission('edit', req => req.params.id), validate(SetTimeModeSchema), (req: Request, res: Response) => {
    const { time_mode, override_until } = req.body;

    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    const updated = repos.boards.update(
      { time_mode, override_until: override_until ?? null },
      req.params.id
    );

    if (override_until) {
      expiryScheduler.schedule({
        id: req.params.id,
        board_id: req.params.id,
        expires_at: new Date(override_until),
        type: 'override',
      });
    } else if (time_mode === 'AUTO') {
      expiryScheduler.cancel(req.params.id, 'override');
    }

    broadcast(req.params.id);
    res.json({ success: true, data: updated });
  });

  return router;
}
