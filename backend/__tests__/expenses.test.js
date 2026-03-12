const request = require('supertest');
const { app, setupDb, closeDb } = require('../server');

let token;

beforeAll(async () => {
    await setupDb();
    const res = await request(app)
        .post('/api/login')
        .send({ email: 'admin@test.com', password: 'testpassword123' });
    token = res.body.token;
});

afterAll(async () => {
    await closeDb();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GET /api/expenses', () => {
    it('returns an array', async () => {
        const res = await request(app).get('/api/expenses').set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('requires auth', async () => {
        const res = await request(app).get('/api/expenses');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/expenses', () => {
    it('creates an expense and returns an id', async () => {
        const res = await request(app)
            .post('/api/expenses')
            .set(auth())
            .send({ description: 'Achat matériel', amount: 49.99, category: 'supplies', date: '2026-01-15' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    it('returns 400 when description is missing', async () => {
        const res = await request(app)
            .post('/api/expenses')
            .set(auth())
            .send({ amount: 20 });
        expect(res.status).toBe(400);
    });

    it('returns 400 for a negative amount', async () => {
        const res = await request(app)
            .post('/api/expenses')
            .set(auth())
            .send({ description: 'Test', amount: -10 });
        expect(res.status).toBe(400);
    });

    it('defaults category to "other" when omitted', async () => {
        const createRes = await request(app)
            .post('/api/expenses')
            .set(auth())
            .send({ description: 'Sans catégorie', amount: 5 });
        expect(createRes.status).toBe(200);
        const listRes = await request(app).get('/api/expenses').set(auth());
        const expense = listRes.body.find(e => e.id === createRes.body.id);
        expect(expense.category).toBe('other');
    });
});

describe('DELETE /api/expenses/:id', () => {
    it('soft-deletes an existing expense', async () => {
        const createRes = await request(app)
            .post('/api/expenses')
            .set(auth())
            .send({ description: 'À supprimer', amount: 10 });
        const id = createRes.body.id;

        const deleteRes = await request(app)
            .delete(`/api/expenses/${id}`)
            .set(auth());
        expect(deleteRes.status).toBe(200);

        // Should no longer appear in list
        const listRes = await request(app).get('/api/expenses').set(auth());
        const found = listRes.body.find(e => e.id === id);
        expect(found).toBeUndefined();
    });

    it('returns 404 for non-existent expense', async () => {
        const res = await request(app)
            .delete('/api/expenses/999999')
            .set(auth());
        expect(res.status).toBe(404);
    });
});

describe('GET /api/stats/monthly', () => {
    it('returns an array of monthly stats', async () => {
        const res = await request(app).get('/api/stats/monthly').set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            const entry = res.body[0];
            expect(entry).toHaveProperty('month');
            expect(entry).toHaveProperty('revenue');
            expect(entry).toHaveProperty('profit');
            expect(entry).toHaveProperty('expenses');
            expect(entry).toHaveProperty('count');
        }
    });

    it('requires auth', async () => {
        const res = await request(app).get('/api/stats/monthly');
        expect(res.status).toBe(401);
    });
});
