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

describe('GET /api/bags', () => {
    it('returns { bags, total } initially empty', async () => {
        const res = await request(app)
            .get('/api/bags')
            .set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('bags');
        expect(res.body).toHaveProperty('total');
        expect(Array.isArray(res.body.bags)).toBe(true);
        expect(res.body.total).toBe(0);
    });

    it('supports search, brand, status, sort and page query params', async () => {
        // create a bag first
        await request(app).post('/api/bags').set(auth()).send({ name: 'Speedy 30', brand: 'Louis Vuitton', status: 'cleaning' });

        const res = await request(app)
            .get('/api/bags?search=Speedy&brand=Louis Vuitton&status=cleaning&sort=date_desc&page=0&limit=10')
            .set(auth());
        expect(res.status).toBe(200);
        expect(res.body.bags.length).toBeGreaterThan(0);
        expect(res.body.bags[0].name).toBe('Speedy 30');
    });
});

describe('GET /api/bags/stats', () => {
    it('returns aggregate stats', async () => {
        const res = await request(app).get('/api/bags/stats').set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalProfit');
        expect(res.body).toHaveProperty('activeRenovations');
        expect(res.body).toHaveProperty('stockValueEst');
        expect(res.body).toHaveProperty('capitalImmobilized');
    });
});

describe('POST /api/bags', () => {
    it('creates a bag and returns an id', async () => {
        const res = await request(app)
            .post('/api/bags')
            .set(auth())
            .send({ name: 'Kelly 28', brand: 'Hermès' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/api/bags')
            .set(auth())
            .send({ brand: 'Hermès' });
        expect(res.status).toBe(400);
    });
});

describe('PUT /api/bags/:id', () => {
    let bagId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/bags')
            .set(auth())
            .send({ name: 'Birkin 30' });
        bagId = res.body.id;
    });

    it('updates an existing bag', async () => {
        const res = await request(app)
            .put(`/api/bags/${bagId}`)
            .set(auth())
            .send({ name: 'Birkin 30 Updated', status: 'cleaning' });
        expect(res.status).toBe(200);
    });

    it('returns 404 for a non-existent bag', async () => {
        const res = await request(app)
            .put('/api/bags/999999')
            .set(auth())
            .send({ name: 'Ghost Bag' });
        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/bags/:id', () => {
    it('deletes an existing bag', async () => {
        const createRes = await request(app)
            .post('/api/bags')
            .set(auth())
            .send({ name: 'To Delete' });
        const id = createRes.body.id;

        const deleteRes = await request(app)
            .delete(`/api/bags/${id}`)
            .set(auth());
        expect(deleteRes.status).toBe(200);
    });
});
