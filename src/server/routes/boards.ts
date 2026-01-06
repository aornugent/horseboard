import { Router, Request, Response } from 'express';
import { UpdateBoardSchema, SetTimeModeSchema, SetOrientationSchema, CreateControllerTokenSchema } from '@shared/resources';
import crypto from 'crypto';
import { validate } from './middleware';
import { authenticate, getBoardPermission } from '../lib/auth';
import type { RouteContext } from './types';

export function createBoardsRouter(ctx: RouteContext): Router {
  const router = Router();
  const { repos, broadcast, expiryScheduler } = ctx;

  // GET /api/boards - list all boards
  router.get('/', authenticate(), (_req: Request, res: Response) => {
    const items = repos.boards.getAll();
    res.json({ success: true, data: items });
  });

  // GET /api/boards/:id - get a specific board
  router.get('/:id', authenticate(), (req: Request, res: Response) => {
    const item = repos.boards.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, item);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: item });
  });

  // POST /api/boards - create a new board
  router.post('/', authenticate(), (req: Request, res: Response) => {
    try {
      const { user_id } = req.auth!;
      const payload = { ...req.body, account_id: user_id || null };
      const item = repos.boards.create(payload);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PATCH /api/boards/:id - update a board
  router.patch('/:id', authenticate(), validate(UpdateBoardSchema), (req: Request, res: Response) => {
    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, existing);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (permission === 'view') {
      return res.status(403).json({ success: false, error: 'Edit permission required' });
    }

    const updated = repos.boards.update(req.body, req.params.id);
    broadcast(req.params.id);
    res.json({ success: true, data: updated });
  });

  // DELETE /api/boards/:id - delete a board
  router.delete('/:id', authenticate(), (req: Request, res: Response) => {
    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, existing);
    if (permission !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin permission required' });
    }

    repos.boards.delete(req.params.id);
    res.json({ success: true });
  });

  // PUT /api/boards/:id/time-mode - set time mode
  router.put('/:id/time-mode', authenticate(), validate(SetTimeModeSchema), (req: Request, res: Response) => {
    const { time_mode, override_until } = req.body;

    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, existing);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (permission === 'view') {
      return res.status(403).json({ success: false, error: 'Edit permission required' });
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

  // PUT /api/boards/:id/orientation - set orientation
  router.put('/:id/orientation', authenticate(), validate(SetOrientationSchema), (req: Request, res: Response) => {
    const { orientation } = req.body;

    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, existing);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (permission === 'view') {
      return res.status(403).json({ success: false, error: 'Edit permission required' });
    }

    const updated = repos.boards.update(
      { orientation, current_page: 0 }, // Reset page on orientation change
      req.params.id
    );

    broadcast(req.params.id);
    res.json({ success: true, data: updated });
  });


  // POST /api/boards/:id/tokens - create a controller token
  router.post('/:id/tokens', authenticate(), validate(CreateControllerTokenSchema), (req: Request, res: Response) => {
    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, existing);
    if (permission !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin permission required' });
    }

    const randomBytes = crypto.randomBytes(32).toString('hex');
    const tokenValue = `hb_${randomBytes}`;
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

    try {
      const created = repos.controllerTokens.create(req.body, req.params.id, tokenHash);

      res.status(201).json({
        success: true,
        data: {
          ...created,
          token: tokenValue // Inject raw token into response
        }
      });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/boards/:id/tokens - list tokens for a board
  router.get('/:id/tokens', authenticate(), (req: Request, res: Response) => {
    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, existing);
    if (permission !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin permission required' });
    }

    const tokens = repos.controllerTokens.getByBoard(req.params.id);
    res.json({ success: true, data: tokens });
  });

  // POST /api/boards/:id/invites - create an invite code
  router.post('/:id/invites', authenticate(), (req: Request, res: Response) => {
    const existing = repos.boards.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, existing);
    if (permission !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin permission required' });
    }

    try {
      const result = repos.inviteCodes.create(req.params.id, 15);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
