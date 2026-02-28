const request = require('supertest');
const { app, setupDb, closeDb } = require('../server');

let token;

beforeAll(async () => {
    await setupDb();
    const res = await request(app)
        .post('/api/login')
        .send({ password: 'testpassword123' });
    token = res.body.token;
});

afterAll(async () => {
    await closeDb();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GET /api/consumables', () => {
    it('returns an array', async () => {
        const res = await request(app).get('/api/consumables').set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('requires auth', async () => {
        const res = await request(app).get('/api/consumables');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/consumables', () => {
    it('creates a consumable and returns an id', async () => {
        const res = await request(app)
            .post('/api/consumables')
            .set(auth())
            .send({ name: 'Cire de selle', purchase_price: 15.5, remaining_percentage: 100 });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/api/consumables')
            .set(auth())
            .send({ purchase_price: 10 });
        expect(res.status).toBe(400);
    });

    it('returns 400 for a negative price', async () => {
        const res = await request(app)
            .post('/api/consumables')
            .set(auth())
            .send({ name: 'Produit test', purchase_price: -5 });
        expect(res.status).toBe(400);
    });
});

describe('PUT /api/consumables/:id', () => {
    let consumableId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/consumables')
            .set(auth())
            .send({ name: 'Produit à modifier', purchase_price: 8, remaining_percentage: 80 });
        consumableId = res.body.id;
    });

    it('updates an existing consumable', async () => {
        const res = await request(app)
            .put(`/api/consumables/${consumableId}`)
            .set(auth())
            .send({ name: 'Produit modifié', purchase_price: 12, remaining_percentage: 60 });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });
});

describe('DELETE /api/consumables/:id', () => {
    it('soft-deletes an existing consumable', async () => {
        const createRes = await request(app)
            .post('/api/consumables')
            .set(auth())
            .send({ name: 'À supprimer', purchase_price: 5 });
        const id = createRes.body.id;

        const deleteRes = await request(app)
            .delete(`/api/consumables/${id}`)
            .set(auth());
        expect(deleteRes.status).toBe(200);

        // Should no longer appear in list
        const listRes = await request(app).get('/api/consumables').set(auth());
        const found = listRes.body.find(c => c.id === id);
        expect(found).toBeUndefined();
    });

    it('returns 404 for non-existent consumable', async () => {
        const res = await request(app)
            .delete('/api/consumables/999999')
            .set(auth());
        expect(res.status).toBe(404);
    });
});
