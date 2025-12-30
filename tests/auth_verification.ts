import Database from 'better-sqlite3';
import {
    createBoardsRepository,
    createControllerTokensRepository,
} from '../src/server/lib/engine';
import { resolveAuth, resolvePermissionForBoard } from '../src/server/lib/auth';
import { runMigrations } from '../src/server/db/migrate';
import { join } from 'path';
import crypto from 'crypto';
import fs from 'fs';

const AUTH_TEST_DB = './data/auth_test.db';

// Clean up previous DB
try {
    fs.rmSync(AUTH_TEST_DB, { force: true });
} catch (e) {
    // ignore
}

// Ensure we Mock the Repos correctly
const db = new Database(AUTH_TEST_DB);
db.pragma('journal_mode = WAL');

// Run migrations
const MIGRATIONS_DIR = join(process.cwd(), 'src/server/db/migrations');
runMigrations(db, MIGRATIONS_DIR);

const repos = {
    boards: createBoardsRepository(db),
    controllerTokens: createControllerTokensRepository(db),
    horses: {} as any,
    feeds: {} as any,
    diet: {} as any,
};

async function testControllerToken() {
    console.log('Testing Controller Token...');

    // 1. Create a board
    const board = repos.boards.create({ timezone: 'UTC' });
    console.log('Created board:', board.id);

    // 2. Create a token
    // Generate random token body
    const randomBody = crypto.randomBytes(16).toString('hex');
    const fullToken = `hb_${randomBody}`;
    // NOTE: Server implementation hashes the FULL token string provided by client
    // including the prefix.
    const tokenHash = crypto.createHash('sha256').update(fullToken).digest('hex');

    const token = repos.controllerTokens.create({
        name: 'Test Setup',
        permission: 'edit',
    }, board.id, tokenHash);

    console.log('Created token:', token.id, 'Hash:', tokenHash);

    // 3. Verify retrieval by hash
    const retrieved = repos.controllerTokens.getByHash(tokenHash);
    if (!retrieved || retrieved.id !== token.id) {
        throw new Error('Failed to retrieve token by hash');
    }
    console.log('Retrieved token by hash OK');

    // 4. Verify resolveAuth
    const req = {
        headers: {
            authorization: `Bearer ${fullToken}`,
        },
    } as any;

    const authCtx = await resolveAuth(req, repos);
    console.log('Resolved Auth Context result:', {
        permission: authCtx.permission,
        token_id: authCtx.token_id
    });

    if (authCtx.permission !== 'edit') throw new Error(`Permission mismatch: expected "edit", got "${authCtx.permission}"`);
    // authCtx.token_id should match the token ID
    if (authCtx.token_id !== token.id) throw new Error(`Token ID mismatch: expected ${token.id}, got ${authCtx.token_id}`);

    if (authCtx.board_id !== board.id) throw new Error(`Board ID mismatch: expected ${board.id}, got ${authCtx.board_id}`);

    console.log('resolveAuth with Valid Token OK');

    // 5. Verify Invalid Token
    const reqInvalid = {
        headers: {
            authorization: `Bearer hb_invalid-token`,
        },
    } as any;

    const authCtxInvalid = await resolveAuth(reqInvalid, repos);
    if (authCtxInvalid.permission !== 'none') throw new Error('Invalid token should return none');
    console.log('resolveAuth with Invalid Token OK');

    // 6. Verify Ownership/Admin Logic
    // Check board ownership logic in resolvePermissionForBoard
    const ownerId = 'user-123';

    // Insert dummy user first to satisfy FK
    db.prepare(`
      INSERT INTO users (id, name, email) VALUES (?, ?, ?)
    `).run(ownerId, 'Test User', 'test@example.com');

    // Use direct SQL to simulate ownership as create() might not support it fully in public API usage
    // (though checking repository implementation suggested it does via passed object)
    // Let's rely on update for certainty in test or SQL.
    const boardOwned = repos.boards.create({ timezone: 'UTC' });
    db.prepare('UPDATE boards SET account_id = ? WHERE id = ?').run(ownerId, boardOwned.id);
    const updatedBoardOwned = repos.boards.getById(boardOwned.id);

    const ctxOwner = {
        permission: 'view', // base
        user_id: ownerId,
        token_id: null,
        board_id: null,
    } as any;

    const perm = resolvePermissionForBoard(ctxOwner, updatedBoardOwned);
    if (perm !== 'admin') throw new Error(`Owner should be admin, got ${perm}`);
    console.log('Owner has admin permission OK');

    const ctxOther = {
        permission: 'view',
        user_id: 'other-user',
        token_id: null,
        board_id: null,
    } as any;

    const permOther = resolvePermissionForBoard(ctxOther, updatedBoardOwned);
    if (permOther !== 'view') throw new Error(`Non-owner should be view, got ${permOther}`);
    console.log('Non-owner has view permission OK');

    console.log('All Tests Passed!');
}

testControllerToken().catch(e => {
    console.error(e);
    process.exit(1);
});
