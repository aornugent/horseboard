import type { Application } from 'express';
import type { SSEManager } from '../lib/engine';
import type { RouteContext } from './types';
import { createBoardsRouter } from './boards';
import { createHorsesRouter } from './horses';
import { createFeedsRouter } from './feeds';
import { createDietRouter } from './diet';
import { createUsersRouter } from './users';
import { createBootstrapRouter, createSSEHandler, createHealthRouter } from './bootstrap';

import { createDevicesRouter } from './devices';
import { createInvitesRouter } from './invites';

export type { RouteContext } from './types';

/**
 * Mount all API routes on the Express app
 */
export function mountRoutes(app: Application, ctx: RouteContext, sse: SSEManager): void {
  // Boards routes
  app.use('/api/boards', createBoardsRouter(ctx));

  // Users routes
  app.use('/api/user', createUsersRouter(ctx));

  // Horses routes (board-scoped and standalone)
  const horsesRouters = createHorsesRouter(ctx);
  app.use('/api/boards/:boardId/horses', horsesRouters.boardScoped);
  app.use('/api/horses', horsesRouters.standalone);

  // Feeds routes (board-scoped and standalone)
  const feedsRouters = createFeedsRouter(ctx);
  app.use('/api/boards/:boardId/feeds', feedsRouters.boardScoped);
  app.use('/api/feeds', feedsRouters.standalone);

  // Diet routes
  app.use('/api/diet', createDietRouter(ctx));

  // Pair endpoint (for code-based pairing)
  app.use('/api', createBootstrapRouter(ctx));

  // Health endpoint
  app.use('/api/health', createHealthRouter(ctx));

  // SSE endpoint (mounted on boards router path)
  app.get('/api/boards/:boardId/events', createSSEHandler(ctx, sse));



  // Devices routes
  app.use('/api/devices', createDevicesRouter(ctx));

  // Invites routes
  app.use('/api/invites', createInvitesRouter(ctx));
}
