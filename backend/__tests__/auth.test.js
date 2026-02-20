const request = require('supertest');
const { app, setupDb, closeDb } = require('../server');

beforeAll(async () => {
    await setupDb();
});

afterAll(async () => {
    await closeDb();
});

describe('POST /api/login', () => {
    it('returns token with correct password', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ password: 'testpassword123' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
    });

    it('returns 401 with wrong password', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ password: 'wrongpassword' });
        expect(res.status).toBe(401);
    });
});

describe('Protected route without token', () => {
    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).get('/api/bags');
        expect(res.status).toBe(401);
    });

    it('returns 403 with an invalid token', async () => {
        const res = await request(app)
            .get('/api/bags')
            .set('Authorization', 'Bearer invalidtoken');
        expect(res.status).toBe(403);
    });
});
