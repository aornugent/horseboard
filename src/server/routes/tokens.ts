import { Router, Request, Response } from 'express';
import { requirePermission } from '../lib/auth';
import type { RouteContext } from './types';

/**
 * Create tokens router
 * 
 * Endpoints:
 * - DELETE /api/tokens/:id - revoke token
 */
export function createTokensRouter(ctx: RouteContext): Router {
    const router = Router();
    const { repos } = ctx;

    // DELETE /api/tokens/:id - revoke token
    // Requires 'admin' permission on the board the token belongs to
    router.delete('/:id', requirePermission('view'), (req: Request, res: Response) => {
        // 1. Get the token to find which board it belongs to
        const token = repos.controllerTokens.getById(req.params.id);

        if (!token) {
            res.status(404).json({ success: false, error: 'Token not found' });
            return;
        }

        // 2. Check if user is admin of that board
        // We already have 'view' permission from middleware (which ensures some auth)
        // Now we need to check specifically for admin rights on this board
        const { user_id } = req.authContext!;
        const board = repos.boards.getById(token.board_id);

        if (!board || board.account_id !== user_id) {
            // Only the board owner can revoke tokens
            res.status(403).json({ success: false, error: 'Insufficient permissions' });
            return;
        }

        // 3. Delete the token
        const success = repos.controllerTokens.delete(req.params.id);

        if (!success) {
            res.status(500).json({ success: false, error: 'Failed to revoke token' });
            return;
        }

        res.json({ success: true });
    });

    // GET /api/tokens/me - resolve current token to board info
    // Requires 'view' permission (which validates the token)
    router.get('/me', requirePermission('view'), (req: Request, res: Response) => {
        const { token_id, board_id, permission } = req.authContext!;

        // If no token ID, they might be using session auth, which is fine but
        // this endpoint is primarily for token resolution.
        if (!token_id && !board_id) {
            res.status(400).json({ success: false, error: 'No active token found' });
            return;
        }

        res.json({
            success: true,
            data: {
                token_id,
                board_id,
                permission
            }
        });
    });

    return router;
}
