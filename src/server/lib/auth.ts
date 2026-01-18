import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth-instance';
import type { Board } from '@shared/resources';
import type {
    ControllerTokensRepository,
    BoardsRepository,
    HorsesRepository,
    FeedsRepository,
    DietRepository,
    InviteCodesRepository,
} from './engine';

export type Permission = 'none' | 'view' | 'edit' | 'admin';

export interface AuthContext {
    permission: Permission;
    user_id: string | null;
    token_id: string | null;
    board_id: string | null;
}

export interface Repos {
    controllerTokens: ControllerTokensRepository;
    boards: BoardsRepository;
    horses: HorsesRepository;
    feeds: FeedsRepository;
    diet: DietRepository;
    inviteCodes: InviteCodesRepository;
}

declare global {
    namespace Express {
        interface Request {
            auth?: AuthContext;
        }
    }
}

/**
 * Resolve authentication context from the request.
 * Checks bearer tokens first, then falls back to session auth.
 */
export async function resolveAuth(req: Request, repos: Repos): Promise<AuthContext> {
    // TEST OVERRIDE: Allow test mode with admin permission for data seeding
    // Uses null user_id to avoid foreign key constraints with non-existent users
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
        return {
            permission: 'admin',
            user_id: null,
            token_id: null,
            board_id: null,
        };
    }

    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer hb_')) {
        const token = authHeader.slice(7);
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const controllerToken = repos.controllerTokens.getByHash(tokenHash);

        if (controllerToken) {
            if (!controllerToken.expires_at || new Date(controllerToken.expires_at) > new Date()) {
                repos.controllerTokens.updateLastUsed(controllerToken.id);
                return {
                    permission: controllerToken.permission as Permission,
                    user_id: null,
                    token_id: controllerToken.id,
                    board_id: controllerToken.board_id,
                };
            }
        }
        return { permission: 'none', user_id: null, token_id: null, board_id: null };
    }

    // Check for Better Auth session
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (session?.user) {
            return {
                user_id: session.user.id,
                token_id: null,
                board_id: null,
                permission: 'view',
            };
        }
    } catch (e) {
        // Session check failed, ignore
    }

    return {
        permission: 'view',
        user_id: null,
        token_id: null,
        board_id: null,
    };
}

/**
 * Determine effective permission for a specific board.
 * - Token auth: permission only valid for the token's board
 * - Session auth: admin on owned boards, view on others
 */
export function resolvePermissionForBoard(
    authCtx: AuthContext,
    board: Board | null
): Permission {
    if (!board) return 'none';

    // Preserve admin permission from test override or other explicit grants
    if (authCtx.permission === 'admin') {
        return 'admin';
    }

    if (authCtx.token_id) {
        return authCtx.board_id === board.id ? authCtx.permission : 'none';
    }

    if (authCtx.user_id) {
        if (board.account_id === authCtx.user_id) {
            return 'admin';
        }
        return 'view';
    }

    return 'view';
}

/**
 * Middleware that validates authentication and attaches req.auth.
 * Returns 401 if no valid authentication is found.
 */
export function authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
        const routeContext = (req as any).context || (req as any).routeContext;
        if (!routeContext) {
            console.error('RouteContext not found on request');
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        const authCtx = await resolveAuth(req, routeContext.repos);

        // For token auth, require valid token (none means invalid/expired)
        const hasToken = req.headers.authorization?.startsWith('Bearer hb_');
        if (hasToken && authCtx.permission === 'none') {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
            });
        }

        // For non-token requests, check if we have a valid session or test override
        if (!hasToken && !authCtx.user_id && !req.headers['x-test-user-id']) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
            });
        }

        req.auth = authCtx;
        next();
    };
}

/**
 * Get the effective permission for a specific board.
 * Use in route handlers to check board-level access.
 *
 * @returns The effective permission for the board, or 'none' if no access
 */
export function getBoardPermission(req: Request, board: Board | null): Permission {
    if (!req.auth || !board) return 'none';
    return resolvePermissionForBoard(req.auth, board);
}
