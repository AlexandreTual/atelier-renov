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
    it('returns empty array initially', async () => {
        const res = await request(app)
            .get('/api/bags')
            .set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
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
