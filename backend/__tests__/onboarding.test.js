const request = require('supertest');
const { app, setupDb, closeDb } = require('../server');

beforeAll(async () => {
    await setupDb();
});

afterAll(async () => {
    await closeDb();
});

describe('GET /api/me', () => {
    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/me');
        expect(res.status).toBe(401);
    });

    it('returns user info with onboarding_done=0 and onboarding_enabled=1 after register', async () => {
        const reg = await request(app)
            .post('/api/register')
            .send({ email: 'onb_user@example.com', password: 'password123' });
        expect(reg.status).toBe(201);
        const token = reg.body.token;

        const res = await request(app)
            .get('/api/me')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('email', 'onb_user@example.com');
        expect(res.body.onboarding_done).toBe(0);
        expect(res.body.onboarding_enabled).toBe(1);
    });
});

describe('POST /api/onboarding/complete', () => {
    it('marks onboarding done and persists', async () => {
        const reg = await request(app)
            .post('/api/register')
            .send({ email: 'onb_complete@example.com', password: 'password123' });
        const token = reg.body.token;

        const complete = await request(app)
            .post('/api/onboarding/complete')
            .set('Authorization', `Bearer ${token}`);
        expect(complete.status).toBe(200);
        expect(complete.body.success).toBe(true);

        const me = await request(app)
            .get('/api/me')
            .set('Authorization', `Bearer ${token}`);
        expect(me.status).toBe(200);
        expect(me.body.onboarding_done).toBe(1);
    });

    it('returns 401 without token', async () => {
        const res = await request(app).post('/api/onboarding/complete');
        expect(res.status).toBe(401);
    });
});
