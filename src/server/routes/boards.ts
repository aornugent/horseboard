import { Router, Request, Response } from 'express';
import { UpdateBoardSchema, SetTimeModeSchema, CreateControllerTokenSchema } from '@shared/resources';
import crypto from 'crypto';
import { validate } from './middleware';
import { requirePermission } from '../lib/auth';
import type { RouteContext } from './types';

export function createBoardsRouter(ctx: RouteContext): Router {
  const router = Router();
  const { repos, broadcast, expiryScheduler } = ctx;

  router.get('/', requirePermission('view'), (_req: Request, res: Response) => {
    const items = repos.boards.getAll();
    res.json({ success: true, data: items });
  });

  router.get('/:id', requirePermission('view', req => req.params.id), (req: Request, res: Response) => {
    const item = repos.boards.getById(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }
    res.json({ success: true, data: item });
  });

  router.post('/', requirePermission('view'), (req: Request, res: Response) => {
    try {
      const { user_id } = req.authContext!;
      const payload = { ...req.body, account_id: user_id || null };
      const item = repos.boards.create(payload);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message });
    }
  });



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

  router.delete('/:id', requirePermission('admin', req => req.params.id), (req: Request, res: Response) => {
    const deleted = repos.boards.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }
    res.json({ success: true });
  });

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

  router.post('/:id/tokens', requirePermission('admin', req => req.params.id), validate(CreateControllerTokenSchema), (req: Request, res: Response) => {
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

  router.get('/:id/tokens', requirePermission('admin', req => req.params.id), (req: Request, res: Response) => {
    const tokens = repos.controllerTokens.getByBoard(req.params.id);
    res.json({ success: true, data: tokens });
  });

  router.post('/:id/invites', requirePermission('admin', req => req.params.id), (req: Request, res: Response) => {
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
