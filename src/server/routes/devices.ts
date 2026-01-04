import { Router, Request, Response } from 'express';
import { requirePermission } from '../lib/auth';
import type { RouteContext } from './types';
import crypto from 'crypto';
import { z } from 'zod';
import { validate } from './middleware';

const LinkDeviceSchema = z.object({
    code: z.string().min(1),
    board_id: z.string().uuid().or(z.string().min(1)), // UUID or robust ID
});

export function createDevicesRouter(ctx: RouteContext): Router {
    const router = Router();
    const { repos, provisioningStore } = ctx;

    // Poll for provisioning status (TV)
    // GET /api/devices/poll?code=XYZ
    router.get('/poll', (req: Request, res: Response) => {
        const code = req.query.code as string;
        if (!code) {
            res.status(400).json({ success: false, error: 'Code required' });
            return;
        }

        // Cleanup old codes (simple garbage collection on access)
        const now = Date.now();
        for (const [key, value] of provisioningStore.entries()) {
            if (now - value.timestamp > 1000 * 60 * 15) { // 15 mins expiry
                provisioningStore.delete(key);
            }
        }

        let data = provisioningStore.get(code);

        if (!data) {
            // Register new code
            data = { code, timestamp: now };
            provisioningStore.set(code, data);
        } else {
            // Update timestamp to keep it alive
            data.timestamp = now;
        }

        if (data.token) {
            // Provisioning complete!
            res.json({ success: true, data: { token: data.token } });
            // Clean up after successful handoff? 
            // Maybe keep it briefly or delete immediately. 
            // If we delete immediately, valid retry might fail. 
            // Let's delete it.
            provisioningStore.delete(code);
        } else {
            res.json({ success: true, data: { pending: true } });
        }
    });

    // GET /api/devices/me - resolve current token to board info
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

    // Link device to board (Controller)
    // POST /api/devices/link
    router.post('/link', requirePermission('view'), validate(LinkDeviceSchema), (req: Request, res: Response) => {
        const { code, board_id } = req.body;
        const { user_id } = req.authContext!;

        // Verify user owns the board (admin rights)
        const board = repos.boards.getById(board_id);
        if (!board) {
            res.status(404).json({ success: false, error: 'Board not found' });
            return;
        }

        if (board.account_id !== user_id) {
            // Only owner can link devices
            res.status(403).json({ success: false, error: 'Insufficient permissions' });
            return;
        }

        const data = provisioningStore.get(code);
        if (!data) {
            res.status(404).json({ success: false, error: 'Device code not found or expired' });
            return;
        }

        // Generate token
        const randomBytes = crypto.randomBytes(32).toString('hex');
        const tokenValue = `hb_${randomBytes}`;
        const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

        try {
            // Create 'display' token
            repos.controllerTokens.create({
                name: `Display ${code}`,
                permission: 'view',
                type: 'display',
            } as any, board_id, tokenHash);



            // Setting the token in store for TV to pick up
            data.token = tokenValue;
            data.board_id = board_id;
            provisioningStore.set(code, data);

            res.json({ success: true, data: { name: `Display ${code}` } });
        } catch (e) {
            res.status(500).json({ success: false, error: (e as Error).message });
        }
    });

    // List linked devices
    // GET /api/devices
    router.get('/', requirePermission('view'), (req: Request, res: Response) => {
        const { user_id } = req.authContext!;

        // Get all boards owned by user
        // We don't have a direct `boards.getByUser`? 
        // `getAll` returns all boards? No, that would be bad. 
        // `boards.ts` `getAll` returns all. 
        // We need to filter.
        const allBoards = repos.boards.getAll(); // Ideally we should have `getByowner`
        const myBoards = allBoards.filter(b => b.account_id === user_id);

        const devices: any[] = [];
        for (const board of myBoards) {
            const tokens = repos.controllerTokens.getByBoard(board.id);
            const displayTokens = tokens.filter((t: any) => t.type === 'display');
            devices.push(...displayTokens.map(t => ({ ...t, board_pair_code: board.pair_code })));
        }

        res.json({ success: true, data: devices });
    });

    // Unlink device
    // DELETE /api/devices/:id
    router.delete('/:id', requirePermission('view'), (req: Request, res: Response) => {
        const token = repos.controllerTokens.getById(req.params.id);
        if (!token) {
            res.status(404).json({ success: false, error: 'Device not found' });
            return;
        }

        const { user_id } = req.authContext!;
        const board = repos.boards.getById(token.board_id);

        if (!board || board.account_id !== user_id) {
            res.status(403).json({ success: false, error: 'Insufficient permissions' });
            return;
        }

        repos.controllerTokens.delete(req.params.id);
        res.json({ success: true });
    });

    return router;
}
