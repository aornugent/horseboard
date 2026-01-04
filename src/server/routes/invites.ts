import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import type { RouteContext } from './types';
import { z } from 'zod';
import { validate } from './middleware';

const RedeemInviteSchema = z.object({
    code: z.string().min(1)
});

export function createInvitesRouter(ctx: RouteContext): Router {
    const router = Router();
    const { repos } = ctx;

    router.post('/redeem', validate(RedeemInviteSchema), (req: Request, res: Response) => {
        const { code } = req.body;

        const invite = repos.inviteCodes.get(code);
        if (!invite) {
            res.status(404).json({ success: false, error: 'Invalid invite code' });
            return;
        }

        if (new Date(invite.expires_at) < new Date()) {
            res.status(400).json({ success: false, error: 'Invite code expired' });
            return;
        }

        const randomBytes = crypto.randomBytes(32).toString('hex');
        const tokenValue = `hb_${randomBytes}`;
        const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

        try {
            const created = repos.controllerTokens.create({
                name: 'Staff (Invite)',
                permission: 'edit',
                type: 'controller',
                expires_at: null
            }, invite.board_id, tokenHash);

            res.status(200).json({
                success: true,
                data: {
                    ...created,
                    token: tokenValue
                }
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
}
