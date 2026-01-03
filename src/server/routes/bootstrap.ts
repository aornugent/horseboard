import { Router, Request, Response } from 'express';
import type { RouteContext } from './types';
import type { SSEManager } from '../lib/engine';
import { resolveAuth, resolvePermissionForBoard, canView } from '../lib/auth';

export function createBootstrapRouter(ctx: RouteContext): Router {
  const router = Router();
  const { repos } = ctx;

  // POST /pair - Accept body { code } and return { board_id, token }
  // SSE handles hydration, so we only need to create token and return minimal data
  router.post('/pair', async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ success: false, error: 'Pairing code required' });
      return;
    }

    const board = repos.boards.getByPairCode(code);

    if (!board) {
      res.status(404).json({ success: false, error: 'Invalid pairing code' });
      return;
    }

    const crypto = await import('crypto');
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const tokenValue = `hb_${randomBytes}`;
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

    repos.controllerTokens.create({
      name: 'Remote Control Session',
      permission: 'view',
      type: 'controller'
    }, board.id, tokenHash);

    res.json({
      success: true,
      data: {
        board_id: board.id,
        token: tokenValue
      },
    });
  });

  return router;
}

export function createSSEHandler(ctx: RouteContext, sse: SSEManager) {
  const { repos } = ctx;

  return async (req: Request, res: Response): Promise<void> => {
    const board = repos.boards.getById(req.params.boardId);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    // Verify permission
    const authCtx = await resolveAuth(req, repos);
    authCtx.permission = resolvePermissionForBoard(authCtx, board);

    if (!canView(authCtx)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sse.addClient(req.params.boardId, res);

    const horses = repos.horses.getByParent(req.params.boardId) ?? [];
    const feeds = repos.feeds.getByParent(req.params.boardId) ?? [];
    const diet_entries = repos.diet.getByBoardId(req.params.boardId) ?? [];

    const initialData = JSON.stringify({
      data: { board, horses, feeds, diet_entries },
      permission: authCtx.permission,
      timestamp: new Date().toISOString(),
    });

    res.write(`data: ${initialData}\n\n`);
  };
}

export function createHealthRouter(ctx: RouteContext): Router {
  const router = Router();
  const { rankingManager, expiryScheduler } = ctx;

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        uptime: process.uptime(),
        scheduler: expiryScheduler.getStats(),
        rankings: rankingManager.getStats(),
      },
    });
  });

  return router;
}
