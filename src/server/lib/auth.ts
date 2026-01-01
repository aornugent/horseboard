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
            authContext?: AuthContext;
        }
    }
}

export function canView(ctx: AuthContext): boolean {
    return ctx.permission !== 'none';
}

export function canEdit(ctx: AuthContext): boolean {
    return ctx.permission === 'edit' || ctx.permission === 'admin';
}

export function canAdmin(ctx: AuthContext): boolean {
    return ctx.permission === 'admin';
}

export async function resolveAuth(req: Request, repos: Repos): Promise<AuthContext> {
    // TEST OVERRIDE: Allow injecting user_id via header in test environment
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
        return {
            permission: 'view',
            user_id: req.headers['x-test-user-id'] as string,
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
        // Invalid or expired token -> continue to check session or return none?
        // Usually invalid token implies we should stop, but let's fall through or return none.
        // If a token is provided but invalid, we probably shouldn't fall back to session implicitly
        // unless designed that way. But "Bearer hb_" is specific.
        // Let's return none if token is invalid.
        return { permission: 'none', user_id: null, token_id: null, board_id: null };
    }

    // 2. Check for Better Auth session
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

export function resolvePermissionForBoard(
    authCtx: AuthContext,
    board: Board | null
): Permission {
    if (!board) return 'none';

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

export function requirePermission(
    level: 'view' | 'edit' | 'admin',
    boardIdResolver?: (req: Request, repos: Repos) => Promise<string | null | undefined> | string | null | undefined
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // We assume routeContext is available on req (attached in server setup)
        const routeContext = (req as any).context || (req as any).routeContext;
        if (!routeContext) {
            console.error('RouteContext not found on request');
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        const repos = routeContext.repos;
        const authCtx = await resolveAuth(req, repos);

        // Determine target board ID
        let boardId: string | null | undefined;

        if (boardIdResolver) {
            boardId = await boardIdResolver(req, repos);
        } else {
            boardId = req.params.boardId || req.params.board_id || req.body?.board_id;
        }

        if (boardId) {
            const board = repos.boards.getById(boardId);
            authCtx.permission = resolvePermissionForBoard(authCtx, board);
            if (board) authCtx.board_id = board.id;
        }

        req.authContext = authCtx;

        const hasPermission =
            (level === 'view' && canView(authCtx)) ||
            (level === 'edit' && canEdit(authCtx)) ||
            (level === 'admin' && canAdmin(authCtx));

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }

        next();
    };
}
