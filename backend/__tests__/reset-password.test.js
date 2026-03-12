const request = require('supertest');
const crypto = require('crypto');
const { app, setupDb, closeDb, query } = require('../server');

const userEmail = 'reset-user@example.com';

beforeAll(async () => {
    await setupDb();
    await request(app)
        .post('/api/register')
        .send({ email: userEmail, password: 'initialpass123' });
});

afterAll(async () => {
    await closeDb();
});

describe('POST /api/forgot-password', () => {
    it('returns 200 for a known email', async () => {
        const res = await request(app)
            .post('/api/forgot-password')
            .send({ email: userEmail });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 for an unknown email (no enumeration)', async () => {
        const res = await request(app)
            .post('/api/forgot-password')
            .send({ email: 'nobody@example.com' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 with no body (no crash)', async () => {
        const res = await request(app)
            .post('/api/forgot-password')
            .send({});
        expect(res.status).toBe(200);
    });
});

describe('POST /api/reset-password', () => {
    async function insertValidToken() {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const userResult = await query('SELECT id FROM users WHERE email = ?', [userEmail]);
        const userId = userResult.rows[0].id;
        await query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [userId, tokenHash, expiresAt]
        );
        return rawToken;
    }

    it('resets password with a valid token and allows login with new password', async () => {
        const rawToken = await insertValidToken();

        const res = await request(app)
            .post('/api/reset-password')
            .send({ token: rawToken, password: 'newpassword456' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Token is now used — second attempt should fail
        const res2 = await request(app)
            .post('/api/reset-password')
            .send({ token: rawToken, password: 'anotherpass789' });
        expect(res2.status).toBe(400);

        // Can login with new password
        const loginRes = await request(app)
            .post('/api/login')
            .send({ email: userEmail, password: 'newpassword456' });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body).toHaveProperty('token');
    });

    it('returns 400 for an expired token', async () => {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiredAt = new Date(Date.now() - 1000).toISOString(); // already expired
        const userResult = await query('SELECT id FROM users WHERE email = ?', [userEmail]);
        await query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [userResult.rows[0].id, tokenHash, expiredAt]
        );

        const res = await request(app)
            .post('/api/reset-password')
            .send({ token: rawToken, password: 'newpassword456' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalide|expiré/i);
    });

    it('returns 400 for an invalid token', async () => {
        const res = await request(app)
            .post('/api/reset-password')
            .send({ token: 'totallywrongtoken', password: 'newpassword123' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when password is too short', async () => {
        const res = await request(app)
            .post('/api/reset-password')
            .send({ token: 'sometoken', password: 'short' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when token is missing', async () => {
        const res = await request(app)
            .post('/api/reset-password')
            .send({ password: 'newpassword123' });
        expect(res.status).toBe(400);
    });
});
