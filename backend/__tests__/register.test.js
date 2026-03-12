const request = require('supertest');
const { app, setupDb, closeDb } = require('../server');

beforeAll(async () => {
    await setupDb();
});

afterAll(async () => {
    await closeDb();
});

describe('POST /api/register', () => {
    it('creates an account and returns a JWT', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: 'alice@example.com', password: 'password123' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
    });

    it('returns 400 when email is missing', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ password: 'password123' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });

    it('returns 400 when email format is invalid', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: 'not-an-email', password: 'password123' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });

    it('returns 400 when password is shorter than 8 chars', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: 'bob@example.com', password: 'short' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/mot de passe/i);
    });

    it('returns 409 when email is already taken', async () => {
        await request(app)
            .post('/api/register')
            .send({ email: 'dup@example.com', password: 'password123' });
        const res = await request(app)
            .post('/api/register')
            .send({ email: 'dup@example.com', password: 'anotherpass' });
        expect(res.status).toBe(409);
    });

    it('new user sees empty bag list after registration', async () => {
        const registerRes = await request(app)
            .post('/api/register')
            .send({ email: 'newuser@example.com', password: 'password123' });
        const token = registerRes.body.token;

        const bagsRes = await request(app)
            .get('/api/bags')
            .set('Authorization', `Bearer ${token}`);
        expect(bagsRes.status).toBe(200);
        expect(bagsRes.body.bags).toEqual([]);
        expect(bagsRes.body.total).toBe(0);
    });
});
