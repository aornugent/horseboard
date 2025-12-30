import { Router, Request, Response } from 'express';
import type { RouteContext } from './types';
import type { SSEManager } from '../lib/engine';
import { requirePermission, resolveAuth, resolvePermissionForBoard, canView } from '../lib/auth';

/**
 * Create bootstrap router for initial state hydration
 *
 * Endpoints:
 * - GET /api/bootstrap/:boardId - full state for UI hydration
 * - GET /api/bootstrap/pair/:code - pair by code, returns full state
 */
export function createBootstrapRouter(ctx: RouteContext): Router {
  const router = Router();
  const { repos } = ctx;

  // GET /api/bootstrap/:boardId - full state for UI hydration
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

    res.json({
      success: true,
      data: { board, horses, feeds, diet_entries, permission },
    });
  });

  // GET /api/bootstrap/pair/:code - pair by code
  router.get('/pair/:code', (req: Request, res: Response) => {
    const board = repos.boards.getByPairCode(req.params.code);

    if (!board) {
      res.status(404).json({ success: false, error: 'Invalid pairing code' });
      return;
    }

    const horses = repos.horses.getByParent(board.id) ?? [];
    const feeds = repos.feeds.getByParent(board.id) ?? [];
    const diet_entries = repos.diet.getByBoardId(board.id) ?? [];

    res.json({
      success: true,
      data: { board, horses, feeds, diet_entries, permission: 'view' },
    });
  });

  return router;
}

/**
 * Create SSE router for real-time updates
 *
 * Endpoints:
 * - GET /api/boards/:boardId/events - SSE endpoint
 */
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
    // Note: We don't have access to modify req.authContext here easily unless we want to, but we just check logic.

    if (!canView(authCtx)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Add client to SSE manager
    sse.addClient(req.params.boardId, res);

    // Send initial full state
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

/**
 * Create health router for monitoring
 *
 * Endpoints:
 * - GET /api/health - health check with stats
 */
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
