
import Database from 'better-sqlite3';
import crypto from 'crypto';

const DB_PATH = './data/horseboard.db';
const BASE_URL = 'http://localhost:3000/api';

async function main() {
    console.log('Connecting to database:', DB_PATH);
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // 1. Setup Data
    const boardId = crypto.randomUUID();
    console.log('Creating test board:', boardId);

    // Create board manually in DB
    const pairCode = Math.floor(100000 + Math.random() * 900000).toString();
    db.prepare(`
        INSERT INTO boards (id, created_at, updated_at, timezone, time_mode, pair_code)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(boardId, new Date().toISOString(), new Date().toISOString(), 'UTC', 'AUTO', pairCode);

    // Create Token
    const rawToken = 'hb_testpermission';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = crypto.randomUUID();

    db.prepare(`
        INSERT INTO controller_tokens (id, board_id, token_hash, name, permission, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tokenId, boardId, tokenHash, 'Test Token', 'edit', new Date().toISOString(), new Date().toISOString());

    console.log('Created test token:', rawToken);

    try {
        // 2. Test Unauthenticated View (Should Succeed)
        console.log('\nTest 1: Unauthenticated GET /boards/:id');
        const res1 = await fetch(`${BASE_URL}/boards/${boardId}`);
        console.log('Status:', res1.status);
        if (res1.status === 200) console.log('PASS');
        else console.error('FAIL', await res1.json());

        // 3. Test Unauthenticated Edit (Should Fail)
        console.log('\nTest 2: Unauthenticated PATCH /boards/:id');
        const res2 = await fetch(`${BASE_URL}/boards/${boardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: 'Australia/Sydney' })
        });
        console.log('Status:', res2.status);
        if (res2.status === 403) console.log('PASS');
        else console.error('FAIL', await res2.json());

        // 4. Test Authenticated Edit (Should Succeed)
        console.log('\nTest 3: Authenticated PATCH /boards/:id');
        const res3 = await fetch(`${BASE_URL}/boards/${boardId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${rawToken}`
            },
            body: JSON.stringify({ timezone: 'Australia/Sydney' })
        });
        console.log('Status:', res3.status);
        if (res3.status === 200) console.log('PASS');
        else console.error('FAIL', await res3.json());

        // 5. Test Authenticated Admin Action (DELETE) with 'edit' token (Should Fail)
        console.log('\nTest 4: Admin DELETE /boards/:id with Edit Token');
        const res4 = await fetch(`${BASE_URL}/boards/${boardId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${rawToken}`
            }
        });
        console.log('Status:', res4.status);
        if (res4.status === 403) console.log('PASS');
        else console.error('FAIL', await res4.json());

        // 6. Test Feeds Protection
        console.log('\nTest 5: Unauthenticated Create Feed (Should Fail)');
        const res5 = await fetch(`${BASE_URL}/boards/${boardId}/feeds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Hay', type: 'Roughage' })
        });
        console.log('Status:', res5.status);
        if (res5.status === 403) console.log('PASS');
        else console.error('FAIL', await res5.json());

        console.log('\nTest 6: Authenticated Create Feed (Should Succeed)');
        const res6 = await fetch(`${BASE_URL}/boards/${boardId}/feeds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${rawToken}`
            },
            body: JSON.stringify({ name: 'Hay', type: 'Roughage' })
        });
        console.log('Status:', res6.status);
        if (res6.status === 201) console.log('PASS');
        else console.error('FAIL', await res6.json());

    } finally {
        // Cleanup
        console.log('\nCleaning up...');
        db.prepare('DELETE FROM controller_tokens WHERE id = ?').run(tokenId);
        db.prepare('DELETE FROM boards WHERE id = ?').run(boardId);
        db.close();
    }
}

main().catch(console.error);
