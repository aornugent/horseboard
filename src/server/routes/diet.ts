import { Router, Request, Response } from 'express';
import { UpsertDietEntrySchema } from '@shared/resources';
import { validate } from './middleware';
import { requirePermission } from '../lib/auth';
import type { RouteContext } from './types';

/**
 * Create diet router with explicit REST endpoints
 *
 * Endpoints:
 * - GET /api/diet?boardId=xxx - list diet entries (optionally by board)
 * - PUT /api/diet - upsert diet entry
 * - DELETE /api/diet/:horse_id/:feed_id - delete diet entry
 */
export function createDietRouter(ctx: RouteContext): Router {
  const router = Router();
  const { repos, rankingManager } = ctx;

  // GET /api/diet?boardId=xxx - list diet entries
  router.get('/', requirePermission('view', req => req.query.boardId as string), (req: Request, res: Response) => {
    if (req.query.boardId) {
      const items = repos.diet.getByBoardId?.(req.query.boardId as string) ?? [];
      res.json({ success: true, data: items });
    } else {
      const items = repos.diet.getAll();
      res.json({ success: true, data: items });
    }
  });

  // PUT /api/diet - upsert diet entry
  router.put('/', requirePermission('edit', async (req, repos) => {
    const horse = repos.horses.getById(req.body.horse_id);
    return horse?.board_id;
  }), validate(UpsertDietEntrySchema), (req: Request, res: Response) => {
    if (!repos.diet.upsert) {
      res.status(500).json({ success: false, error: 'Upsert not supported' });
      return;
    }

    const entry = repos.diet.upsert(req.body);

    // Trigger ranking recalculation
    const horse = repos.horses.getById(req.body.horse_id);
    if (horse) {
      rankingManager.scheduleRecalculation(horse.board_id);
    }

    res.json({ success: true, data: entry });
  });

  // DELETE /api/diet/:horse_id/:feed_id - delete diet entry
  router.delete('/:horse_id/:feed_id', requirePermission('edit', async (req, repos) => {
    const horse = repos.horses.getById(req.params.horse_id);
    return horse?.board_id;
  }), (req: Request, res: Response) => {
    const deleted = repos.diet.delete(req.params.horse_id, req.params.feed_id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Diet entry not found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
