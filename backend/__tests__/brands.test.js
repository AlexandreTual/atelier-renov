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

describe('Brands', () => {
    let brandId;

    it('POST /api/brands creates a brand', async () => {
        const res = await request(app)
            .post('/api/brands')
            .set(auth())
            .send({ name: 'TestBrand' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        brandId = res.body.id;
    });

    it('POST /api/brands returns 400 for duplicate', async () => {
        const res = await request(app)
            .post('/api/brands')
            .set(auth())
            .send({ name: 'TestBrand' });
        expect(res.status).toBe(400);
    });

    it('PUT /api/brands/:id updates a brand', async () => {
        const res = await request(app)
            .put(`/api/brands/${brandId}`)
            .set(auth())
            .send({ name: 'TestBrand Updated' });
        expect(res.status).toBe(200);
    });

    it('DELETE /api/brands/:id deletes a brand', async () => {
        const res = await request(app)
            .delete(`/api/brands/${brandId}`)
            .set(auth());
        expect(res.status).toBe(200);
    });
});

describe('Item Types', () => {
    let typeId;

    it('POST /api/item-types creates an item type', async () => {
        const res = await request(app)
            .post('/api/item-types')
            .set(auth())
            .send({ name: 'TestType' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        typeId = res.body.id;
    });

    it('PUT /api/item-types/:id updates an item type', async () => {
        const res = await request(app)
            .put(`/api/item-types/${typeId}`)
            .set(auth())
            .send({ name: 'TestType Updated' });
        expect(res.status).toBe(200);
    });

    it('DELETE /api/item-types/:id deletes an item type', async () => {
        const res = await request(app)
            .delete(`/api/item-types/${typeId}`)
            .set(auth());
        expect(res.status).toBe(200);
    });
});
