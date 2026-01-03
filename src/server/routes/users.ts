import { Router, Request, Response } from 'express';
import { resolveAuth } from '../lib/auth';
import type { RouteContext } from './types';

export function createUsersRouter(ctx: RouteContext): Router {
    const router = Router();
    const { repos } = ctx;

    router.get('/boards', async (req: Request, res: Response) => {
        try {
            const authCtx = await resolveAuth(req, repos);

            if (!authCtx.user_id) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const boards = repos.boards.getByAccount(authCtx.user_id);

            return res.json({
                success: true,
                data: boards
            });
        } catch (error) {
            console.error('Error fetching user boards:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error'
            });
        }
    });

    // Keeping this placeholder just in case, or we can omit it.
    // The previous plan had it, so I'll keep it but return 501.
    // Actually, I can just return succes: true and empty data or 404.
    // But since it's not strictly needed for "Board Claiming Flow", I'll omit it to avoid clutter.
    // The previous prompt had it returning 501.

    return router;
}
