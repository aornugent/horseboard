import { Router, Request, Response } from 'express';
import { CreateHorseSchema, UpdateHorseSchema } from '@shared/resources';
import { validate } from './middleware';
import { authenticate, requireEdit, getBoardPermission } from '../lib/auth';
import type { RouteContext } from './types';

/**
 * Create horses router with explicit REST endpoints
 *
 * Endpoints:
 * - GET /api/boards/:boardId/horses - list horses for a board
 * - POST /api/boards/:boardId/horses - create horse under board
 * - GET /api/horses/:id - get horse by id
 * - PATCH /api/horses/:id - update horse
 * - DELETE /api/horses/:id - delete horse
 */
export function createHorsesRouter(ctx: RouteContext): { boardScoped: Router; standalone: Router } {
  const boardScoped = Router({ mergeParams: true });
  const standalone = Router();
  const { repos, broadcast } = ctx;

  // GET /api/boards/:boardId/horses - list horses for a board
  boardScoped.get('/', authenticate(), (req: Request, res: Response) => {
    const board = repos.boards.getById(req.params.boardId);
    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found' });
    }

    const permission = getBoardPermission(req, board);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const items = repos.horses.getByParent(req.params.boardId);
    res.json({ success: true, data: items });
  });

  // POST /api/boards/:boardId/horses - create horse under board
  boardScoped.post('/', authenticate(), validate(CreateHorseSchema), (req: Request, res: Response) => {
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
      const item = repos.horses.create(req.body, req.params.boardId);
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

  // GET /api/horses/:id - get horse by id
  standalone.get('/:id', authenticate(), (req: Request, res: Response) => {
    const horse = repos.horses.getById(req.params.id);
    if (!horse) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }

    const board = repos.boards.getById(horse.board_id);
    const permission = getBoardPermission(req, board);
    if (permission === 'none') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: horse });
  });

  // PATCH /api/horses/:id - update horse
  standalone.patch('/:id', authenticate(), requireEdit, validate(UpdateHorseSchema), (req: Request, res: Response) => {
    const existing = repos.horses.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }

    const board = repos.boards.getById(existing.board_id);
    const permission = getBoardPermission(req, board);
    if (permission === 'none' || permission === 'view') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const updated = repos.horses.update(req.body, req.params.id);
    broadcast(existing.board_id);
    res.json({ success: true, data: updated });
  });

  // DELETE /api/horses/:id - delete horse
  standalone.delete('/:id', authenticate(), requireEdit, (req: Request, res: Response) => {
    const existing = repos.horses.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }

    const board = repos.boards.getById(existing.board_id);
    const permission = getBoardPermission(req, board);
    if (permission === 'none' || permission === 'view') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    repos.horses.delete(req.params.id);
    broadcast(existing.board_id);
    res.json({ success: true });
  });

  return { boardScoped, standalone };
}
