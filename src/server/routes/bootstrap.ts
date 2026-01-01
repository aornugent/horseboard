import { Router, Request, Response } from 'express';
import type { RouteContext } from './types';
import type { SSEManager } from '../lib/engine';
import { requirePermission, resolveAuth, resolvePermissionForBoard, canView } from '../lib/auth';

export function createBootstrapRouter(ctx: RouteContext): Router {
  const router = Router();
  const { repos } = ctx;

  router.get('/:boardId', requirePermission('view'), (req: Request, res: Response) => {
    const board = repos.boards.getById(req.params.boardId);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    const horses = repos.horses.getByParent(req.params.boardId) ?? [];
    const feeds = repos.feeds.getByParent(req.params.boardId) ?? [];
    const diet_entries = repos.diet.getByBoardId(req.params.boardId) ?? [];

    const permission = req.authContext?.permission || 'view';
    const user_id = req.authContext?.user_id;

    const ownership = {
      is_owner: !!user_id && board.account_id === user_id,
      permission
    };

    res.json({
      success: true,
      data: { board, horses, feeds, diet_entries, ownership },
    });
  });

  router.get('/pair/:code', async (req: Request, res: Response) => {
    const board = repos.boards.getByPairCode(req.params.code);

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

    const authCtx = await resolveAuth(req, repos);
    authCtx.permission = resolvePermissionForBoard(authCtx, board);

    const horses = repos.horses.getByParent(board.id) ?? [];
    const feeds = repos.feeds.getByParent(board.id) ?? [];
    const diet_entries = repos.diet.getByBoardId(board.id) ?? [];

    const ownership = {
      is_owner: !!authCtx.user_id && board.account_id === authCtx.user_id,
      permission: authCtx.permission
    };

    res.json({
      success: true,
      data: {
        board,
        horses,
        feeds,
        diet_entries,
        ownership,
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
      data: { board, horses, feeds, diet_entries, permission: authCtx.permission },
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
